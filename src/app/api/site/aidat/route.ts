/**
 * /api/site/aidat — siteyönetim aidat ledger listesi.
 *
 * Token/cookie auth → yönettiği binadan sy_dues_ledger satırlarını döner
 * (sy_units.unit_number ile join). Filtreleme:
 *   - ?filter=unpaid (default 'all') — sadece ödenmemişler
 *   - ?period=YYYY-MM — belirli dönem
 *
 * Sıralama: en yeni dönem önce, sonra daire numarası asc.
 * Tutarlar kuruşta saklı; response TL'ye çevrilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";


interface LedgerRow {
  id: string;
  period: string | null;
  amount: number | null;
  paid_amount: number | null;
  late_charge_kurus: number | null;
  is_paid: boolean | null;
  sy_units: { unit_number: string | null } | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const filter = req.nextUrl.searchParams.get("filter") || "all";
  const period = req.nextUrl.searchParams.get("period");

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return NextResponse.json({
      success: true,
      building: null,
      ledger: [],
      summary: { totalDueTL: 0, totalPaidTL: 0, unpaidCount: 0 },
    });
  }

  let query = sb
    .from("sy_dues_ledger")
    .select("id, period, amount, paid_amount, late_charge_kurus, is_paid, sy_units(unit_number)")
    .eq("building_id", building.id);

  if (filter === "unpaid") query = query.eq("is_paid", false);
  if (period) query = query.eq("period", period);

  const { data, error } = await query;
  if (error) {
    console.error("[site/aidat GET] error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  const rows = (data || []) as unknown as LedgerRow[];

  let totalDueKurus = 0;
  let totalPaidKurus = 0;
  let unpaidCount = 0;

  const ledger = rows.map((r) => {
    const amount = r.amount || 0;
    const paid = r.paid_amount || 0;
    const late = r.late_charge_kurus || 0;
    const owed = Math.max(amount - paid + late, 0);

    if (!r.is_paid) {
      totalDueKurus += owed;
      unpaidCount += 1;
    }
    totalPaidKurus += paid;

    return {
      id: r.id,
      period: r.period || "—",
      unit_number: r.sy_units?.unit_number || "—",
      amount_tl: amount / 100,
      paid_tl: paid / 100,
      late_tl: late / 100,
      owed_tl: owed / 100,
      is_paid: r.is_paid === true,
    };
  });

  // Period desc, sonra unit asc (natural sort)
  ledger.sort((a, b) => {
    if (a.period !== b.period) return b.period.localeCompare(a.period);
    const am = a.unit_number.match(/^(\d+)(.*)$/);
    const bm = b.unit_number.match(/^(\d+)(.*)$/);
    if (am && bm) {
      const n = parseInt(am[1], 10) - parseInt(bm[1], 10);
      if (n !== 0) return n;
      return am[2].localeCompare(bm[2]);
    }
    return a.unit_number.localeCompare(b.unit_number);
  });

  return NextResponse.json({
    success: true,
    building: { id: building.id, name: building.name || "Apartman" },
    ledger,
    summary: {
      totalDueTL: Math.round(totalDueKurus / 100),
      totalPaidTL: Math.round(totalPaidKurus / 100),
      unpaidCount,
    },
  });
}
