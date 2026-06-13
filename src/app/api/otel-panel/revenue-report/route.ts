/**
 * /api/otel-panel/revenue-report — Detaylı gelir raporu (Faz 1F)
 *
 * Periods:
 *   - daily: son 30 gün, gün bazlı
 *   - monthly: son 12 ay, ay bazlı
 *
 * KPI'lar:
 *   - total_revenue: ciro (check_in tarihine göre period içinde)
 *   - room_nights: satılan gece sayısı
 *   - adr: Average Daily Rate = revenue / room_nights
 *   - occupancy_pct: doluluk = booked_nights / available_nights
 *   - revpar: Revenue Per Available Room = revenue / available_nights
 *   - by_source: kaynak dağılımı (manual/booking/expedia/walk-in...)
 *   - by_status: durum dağılımı
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, period: {}, series: [], by_source: [], by_status: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, period: {}, series: [], by_source: [], by_status: [] });

  const periodType = (req.nextUrl.searchParams.get("period") || "daily") as "daily" | "monthly";
  const days = periodType === "monthly" ? 365 : 30;
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - days);
  const startIso = startDate.toISOString().slice(0, 10);

  const [rezRes, roomCountRes] = await Promise.all([
    sb.from("otel_reservations")
      .select("id, check_in, check_out, total_price, status, source")
      .in("hotel_id", hotelIds)
      .gte("check_in", startIso)
      .neq("status", "cancelled"),
    sb.from("otel_rooms")
      .select("*", { count: "exact", head: true })
      .in("hotel_id", hotelIds),
  ]);

  const reservations = rezRes.data || [];
  const totalRooms = roomCountRes.count || 0;
  const periodDays = days;
  const availableNights = totalRooms * periodDays;

  // Toplam KPI
  let totalRevenue = 0;
  let roomNights = 0;
  for (const r of reservations) {
    totalRevenue += Number(r.total_price) || 0;
    const ci = new Date(r.check_in), co = new Date(r.check_out);
    const nights = Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
    roomNights += nights;
  }
  const adr = roomNights > 0 ? totalRevenue / roomNights : 0;
  const occupancyPct = availableNights > 0 ? (roomNights / availableNights) * 100 : 0;
  const revpar = availableNights > 0 ? totalRevenue / availableNights : 0;

  // Time series
  const buckets = new Map<string, { revenue: number; nights: number; count: number }>();
  for (const r of reservations) {
    const key = periodType === "monthly" ? r.check_in.slice(0, 7) : r.check_in.slice(0, 10);
    const b = buckets.get(key) || { revenue: 0, nights: 0, count: 0 };
    b.revenue += Number(r.total_price) || 0;
    const ci = new Date(r.check_in), co = new Date(r.check_out);
    b.nights += Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
    b.count += 1;
    buckets.set(key, b);
  }
  const series = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => ({ bucket: key, revenue: Math.round(val.revenue), nights: val.nights, count: val.count }));

  // Source breakdown
  const sourceMap = new Map<string, { revenue: number; count: number }>();
  for (const r of reservations) {
    const k = r.source || "bilinmiyor";
    const v = sourceMap.get(k) || { revenue: 0, count: 0 };
    v.revenue += Number(r.total_price) || 0;
    v.count += 1;
    sourceMap.set(k, v);
  }
  const by_source = Array.from(sourceMap.entries()).map(([source, v]) => ({
    source, revenue: Math.round(v.revenue), count: v.count,
  })).sort((a, b) => b.revenue - a.revenue);

  // Status breakdown
  const statusMap = new Map<string, number>();
  for (const r of reservations) {
    statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
  }
  const by_status = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

  return NextResponse.json({
    success: true,
    period: {
      type: periodType,
      days: periodDays,
      total_revenue: Math.round(totalRevenue),
      room_nights: roomNights,
      adr: Math.round(adr),
      occupancy_pct: Math.round(occupancyPct * 10) / 10,
      revpar: Math.round(revpar),
      total_rooms: totalRooms,
      reservations_count: reservations.length,
    },
    series,
    by_source,
    by_status,
  });
}
