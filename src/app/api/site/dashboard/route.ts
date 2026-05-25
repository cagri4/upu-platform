/**
 * /api/site/dashboard — siteyönetim Dashboard KPI count'ları.
 * Token doğrula + yöneticinin binasından paralel sayım.
 *
 * KPI'lar:
 *   payment_due_units       — Ödenmemiş aidatı olan distinct daire
 *   open_complaints         — Açık arıza/şikayet talebi
 *   active_residents        — Aktif sakin
 *   monthly_dues_collected  — Bu ay aidat tahsilatı (TL)
 *   total_units             — Bina toplam daire sayısı
 *   overdue_amount          — Tüm dönemler toplam ödenmemiş borç (TL)
 *   occupancy_rate          — Doluluk oranı (% — sakinli daire / toplam daire)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const SITEYONETIM_TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

interface DuesLedgerRow {
  unit_id: string | null;
  amount: number | null;
  paid_amount: number | null;
  late_charge_kurus: number | null;
  is_paid: boolean | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const userId = lookup.profile.id;

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id")
    .eq("manager_id", userId)
    .eq("tenant_id", SITEYONETIM_TENANT_ID)
    .limit(1)
    .maybeSingle();

  const emptyKpis = {
    payment_due_units: 0,
    open_complaints: 0,
    active_residents: 0,
    monthly_dues_collected: 0,
    total_units: 0,
    overdue_amount: 0,
    occupancy_rate: 0,
  };

  if (!building?.id) {
    return NextResponse.json({ success: true, kpis: emptyKpis });
  }

  const buildingId = building.id;
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [
    duesLedgerRes,
    openComplaintsRes,
    activeResidentsRes,
    monthlyIncomeRes,
    totalUnitsRes,
  ] = await Promise.all([
    sb.from("sy_dues_ledger")
      .select("unit_id, amount, paid_amount, late_charge_kurus, is_paid")
      .eq("building_id", buildingId),
    sb.from("sy_maintenance_tickets")
      .select("*", { count: "exact", head: true })
      .eq("building_id", buildingId)
      .eq("status", "acik"),
    sb.from("sy_residents")
      .select("*", { count: "exact", head: true })
      .eq("building_id", buildingId)
      .eq("is_active", true),
    sb.from("sy_income_expenses")
      .select("amount_kurus")
      .eq("building_id", buildingId)
      .eq("type", "income")
      .eq("period", currentPeriod),
    sb.from("sy_units")
      .select("*", { count: "exact", head: true })
      .eq("building_id", buildingId),
  ]);

  const dueUnitIds = new Set<string>();
  let overdueKurus = 0;
  for (const row of (duesLedgerRes.data || []) as DuesLedgerRow[]) {
    if (row.is_paid) continue;
    if (row.unit_id) dueUnitIds.add(row.unit_id);
    const owed = (row.amount || 0) - (row.paid_amount || 0) + (row.late_charge_kurus || 0);
    if (owed > 0) overdueKurus += owed;
  }

  let monthlyDuesTL = 0;
  for (const r of monthlyIncomeRes.data || []) {
    monthlyDuesTL += (r.amount_kurus as number || 0) / 100;
  }

  const totalUnits = totalUnitsRes.count || 0;
  const activeResidents = activeResidentsRes.count || 0;
  // Sakinli daire = aktif sakin sayısı (her sakin tek dairede tutuluyor — basit yaklaşım)
  const occupancyRate = totalUnits > 0
    ? Math.round((Math.min(activeResidents, totalUnits) / totalUnits) * 100)
    : 0;

  return NextResponse.json({
    success: true,
    kpis: {
      payment_due_units: dueUnitIds.size,
      open_complaints: openComplaintsRes.count || 0,
      active_residents: activeResidents,
      monthly_dues_collected: Math.round(monthlyDuesTL),
      total_units: totalUnits,
      overdue_amount: Math.round(overdueKurus / 100),
      occupancy_rate: occupancyRate,
    },
  });
}
