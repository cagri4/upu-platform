/**
 * GET /api/dagitici/saha/dashboard?region=&rep_id=&days=30 — saha performans özeti.
 *
 * Eleman başına: ziyaret sayısı (dönem), tamamlanan ziyaret, ziyarette
 * alınan sipariş sayısı, ziyaret/sipariş oranı, son aktivite. Bölge/eleman
 * filtresi. Tüm sorgular tenant'a scoped.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const region = url.searchParams.get("region");
  const repFilter = url.searchParams.get("rep_id");
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Elemanlar (filtreli)
  let repQ = sb
    .from("bayi_sales_reps")
    .select("id, name, region, is_active")
    .eq("tenant_id", tenantId);
  if (region) repQ = repQ.eq("region", region);
  if (repFilter) repQ = repQ.eq("id", repFilter);
  const { data: reps } = await repQ;

  const repIds = (reps ?? []).map((r) => r.id as string);
  const visitTotal = new Map<string, number>();
  const visitDone = new Map<string, number>();
  const orderCount = new Map<string, number>();
  const lastActivity = new Map<string, string>();
  const visitIdToRep = new Map<string, string>();

  if (repIds.length > 0) {
    const { data: visits } = await sb
      .from("bayi_visits")
      .select("id, sales_rep_id, status, check_in_at")
      .eq("tenant_id", tenantId)
      .in("sales_rep_id", repIds)
      .gte("check_in_at", sinceIso)
      .order("check_in_at", { ascending: false });
    for (const v of visits ?? []) {
      const rid = v.sales_rep_id as string;
      visitTotal.set(rid, (visitTotal.get(rid) ?? 0) + 1);
      if (v.status === "completed") visitDone.set(rid, (visitDone.get(rid) ?? 0) + 1);
      if (!lastActivity.has(rid)) lastActivity.set(rid, v.check_in_at as string);
      visitIdToRep.set(v.id as string, rid);
    }

    const visitIds = Array.from(visitIdToRep.keys());
    if (visitIds.length > 0) {
      const { data: vorders } = await sb
        .from("bayi_visit_orders")
        .select("visit_id")
        .eq("tenant_id", tenantId)
        .in("visit_id", visitIds);
      for (const vo of vorders ?? []) {
        const rid = visitIdToRep.get(vo.visit_id as string);
        if (rid) orderCount.set(rid, (orderCount.get(rid) ?? 0) + 1);
      }
    }
  }

  const rows = (reps ?? []).map((r) => {
    const rid = r.id as string;
    const visits = visitTotal.get(rid) ?? 0;
    const orders = orderCount.get(rid) ?? 0;
    return {
      id: rid,
      name: r.name as string,
      region: (r.region as string) || null,
      isActive: Boolean(r.is_active),
      visits,
      completedVisits: visitDone.get(rid) ?? 0,
      orders,
      orderRatio: visits > 0 ? +(orders / visits).toFixed(2) : 0,
      lastActivityAt: lastActivity.get(rid) ?? null,
    };
  });

  // Bölge listesi (filtre dropdown'u için)
  const { data: regionRows } = await sb
    .from("bayi_sales_reps")
    .select("region")
    .eq("tenant_id", tenantId)
    .not("region", "is", null);
  const regions = Array.from(
    new Set((regionRows ?? []).map((r) => (r.region as string) || "").filter(Boolean)),
  ).sort();

  return NextResponse.json({
    success: true,
    days,
    totals: {
      reps: rows.length,
      visits: rows.reduce((s, r) => s + r.visits, 0),
      orders: rows.reduce((s, r) => s + r.orders, 0),
    },
    rows,
    regions,
  });
}
