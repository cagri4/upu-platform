/**
 * /api/otel-panel/calendar — Doluluk takvimi (Faz 1A)
 *
 * Query param: start (ISO date, default: bugün)
 * Default 30 gün ileri grid.
 *
 * Çıktı:
 *   rooms: [{ id, name, room_type, status, base_price }]
 *   reservations: [{ id, room_id, guest_name, check_in, check_out, status }]
 *   dates: [{ date, day, weekday }]  — UI'da kolon başlığı için
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const DAYS = 30;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, rooms: [], reservations: [], dates: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, rooms: [], reservations: [], dates: [] });

  const startParam = req.nextUrl.searchParams.get("start");
  const start = startParam ? new Date(startParam) : new Date();
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString().slice(0, 10);
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + DAYS);
  const endIso = endDate.toISOString().slice(0, 10);

  const dates: { date: string; day: number; weekday: string }[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push({
      date: d.toISOString().slice(0, 10),
      day: d.getDate(),
      weekday: d.toLocaleDateString("tr-TR", { weekday: "short" }),
    });
  }

  const [roomsRes, rezRes] = await Promise.all([
    sb.from("otel_rooms")
      .select("id, name, room_type, status, base_price, sort_order")
      .in("hotel_id", hotelIds)
      .order("sort_order", { ascending: true }),
    sb.from("otel_reservations")
      .select("id, room_id, guest_name, check_in, check_out, status, total_price")
      .in("hotel_id", hotelIds)
      .neq("status", "cancelled")
      .lt("check_in", endIso)
      .gte("check_out", startIso),
  ]);

  return NextResponse.json({
    success: true,
    start: startIso,
    end: endIso,
    rooms: roomsRes.data || [],
    reservations: rezRes.data || [],
    dates,
  });
}
