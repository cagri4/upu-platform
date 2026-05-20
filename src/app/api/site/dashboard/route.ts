/**
 * /api/site/dashboard — siteyönetim Dashboard KPI count'ları.
 * Token doğrula + yöneticinin binasından 6 paralel sayım.
 *
 * KPI'lar:
 *   payment_due_units       — Ödenmemiş aidatı olan distinct daire
 *   open_complaints         — Açık arıza/şikayet talebi
 *   active_residents        — Aktif sakin
 *   monthly_dues_collected  — Bu ay aidat tahsilatı (TL)
 *   upcoming_events         — Yaklaşan etkinlik (placeholder, modül henüz yok)
 *   active_staff_tasks      — Aktif personel görevi (placeholder, modül henüz yok)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const SITEYONETIM_TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

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

  // Yöneticilik yaptığı bina(lar). Tek bina varsayımı — birden fazla
  // varsa ilki alınır (multi-building V2'de adreslenecek).
  const { data: building } = await sb
    .from("sy_buildings")
    .select("id")
    .eq("manager_id", userId)
    .eq("tenant_id", SITEYONETIM_TENANT_ID)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return NextResponse.json({
      success: true,
      kpis: {
        payment_due_units: 0,
        open_complaints: 0,
        active_residents: 0,
        monthly_dues_collected: 0,
        upcoming_events: 0,
        active_staff_tasks: 0,
      },
    });
  }

  const buildingId = building.id;

  // Bu ay periyodu — sy_dues_ledger.period 'YYYY-MM' formatında saklanır.
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 6 paralel sorgu
  const [
    paymentDueRes,
    openComplaintsRes,
    activeResidentsRes,
    monthlyDuesRes,
  ] = await Promise.all([
    // Ödenmemiş aidat — distinct unit_id sayımı için unit_id seç + Set'le say
    sb.from("sy_dues_ledger")
      .select("unit_id")
      .eq("building_id", buildingId)
      .eq("is_paid", false),
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
  ]);

  // Distinct daire sayısı — bir daire birden fazla dönem borçlu olabilir
  const dueUnitIds = new Set<string>();
  for (const row of paymentDueRes.data || []) {
    if (row.unit_id) dueUnitIds.add(row.unit_id as string);
  }

  // Bu ay tahsilat toplamı (kuruş → TL)
  let monthlyDuesTL = 0;
  for (const r of monthlyDuesRes.data || []) {
    monthlyDuesTL += (r.amount_kurus as number || 0) / 100;
  }

  return NextResponse.json({
    success: true,
    kpis: {
      payment_due_units: dueUnitIds.size,
      open_complaints: openComplaintsRes.count || 0,
      active_residents: activeResidentsRes.count || 0,
      monthly_dues_collected: Math.round(monthlyDuesTL),
      upcoming_events: 0,        // modül V2
      active_staff_tasks: 0,     // modül V2
    },
  });
}
