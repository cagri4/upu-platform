/**
 * /api/otel-panel/list-rooms — owner'ın hotel scope'undaki tüm odalar.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const { data: ouhRows } = await sb.from("otel_user_hotels").select("hotel_id").eq("user_id", pt.user_id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, rooms: [] });

  const { data: rooms } = await sb
    .from("otel_rooms")
    .select("id, name, room_type, bed_type, max_occupancy, base_price, status, sort_order")
    .in("hotel_id", hotelIds)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ success: true, rooms: rooms || [] });
}
