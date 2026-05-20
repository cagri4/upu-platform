/**
 * /api/otel-panel/dashboard — Otel dashboard 6 KPI.
 *
 * KPI'lar (otel front-office odaklı):
 *   - occupancy_pct       — bugün konaklamada (checked_in) / toplam oda
 *   - reservations_week   — bu hafta gelen + gelecek rezervasyonlar
 *   - today_checkin       — bugün giriş yapacak rezervasyonlar
 *   - today_checkout      — bugün çıkış yapacak rezervasyonlar
 *   - monthly_revenue     — bu ay (check_in tarihine göre) ciro
 *   - precheckin_pending  — yakında gelecek + online check-in eksik (=fırsat)
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
    userId: auth.userId,
    tenantKey: "otel",
    select: "id",
  });
  if ("error" in lookup) {
    return NextResponse.json({
      success: true,
      kpis: {
        occupancy_pct: 0, reservations_week: 0, today_checkin: 0,
        today_checkout: 0, monthly_revenue: 0, precheckin_pending: 0,
      },
    });
  }

  // Owner'ın hotel scope'u — multi-property
  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) {
    return NextResponse.json({
      success: true,
      kpis: {
        occupancy_pct: 0, reservations_week: 0, today_checkin: 0,
        today_checkout: 0, monthly_revenue: 0, precheckin_pending: 0,
      },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const startOfMonth = new Date(); startOfMonth.setDate(1);
  const startOfMonthIso = startOfMonth.toISOString().slice(0, 10);

  const [
    occupancyRez,
    totalRooms,
    weekRez,
    todayCheckin,
    todayCheckout,
    monthRez,
    precheckinPending,
  ] = await Promise.all([
    sb.from("otel_reservations").select("*", { count: "exact", head: true })
      .in("hotel_id", hotelIds).eq("status", "checked_in"),
    sb.from("otel_rooms").select("*", { count: "exact", head: true })
      .in("hotel_id", hotelIds),
    sb.from("otel_reservations").select("*", { count: "exact", head: true })
      .in("hotel_id", hotelIds).gte("check_in", today).lt("check_in", weekFromNow)
      .neq("status", "cancelled"),
    sb.from("otel_reservations").select("*", { count: "exact", head: true })
      .in("hotel_id", hotelIds).eq("check_in", today).neq("status", "cancelled"),
    sb.from("otel_reservations").select("*", { count: "exact", head: true })
      .in("hotel_id", hotelIds).eq("check_out", today).neq("status", "cancelled"),
    sb.from("otel_reservations").select("total_price")
      .in("hotel_id", hotelIds).gte("check_in", startOfMonthIso).neq("status", "cancelled"),
    sb.from("otel_reservations").select("*", { count: "exact", head: true })
      .in("hotel_id", hotelIds).gte("check_in", today).lt("check_in", weekFromNow)
      .eq("pre_checkin_complete", false).neq("status", "cancelled"),
  ]);

  const occupied = occupancyRez.count || 0;
  const total = totalRooms.count || 0;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const monthlyRevenue = (monthRez.data || [])
    .reduce((sum: number, r: any) => sum + (Number(r.total_price) || 0), 0);

  return NextResponse.json({
    success: true,
    kpis: {
      occupancy_pct: occupancyPct,
      reservations_week: weekRez.count || 0,
      today_checkin: todayCheckin.count || 0,
      today_checkout: todayCheckout.count || 0,
      monthly_revenue: Math.round(monthlyRevenue),
      precheckin_pending: precheckinPending.count || 0,
    },
  });
}
