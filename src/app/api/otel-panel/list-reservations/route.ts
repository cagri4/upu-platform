/**
 * /api/otel-panel/list-reservations — owner'ın hotel scope'undaki son
 * rezervasyonlar. Liste sayfası (otel-rezervasyonlar) bunu çağırır.
 *
 * Token doğrula → otel_user_hotels'tan hotel_id listesi → 50 son rez (oda
 * adı join'li).
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

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", pt.user_id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, reservations: [] });

  const { data: rezs } = await sb
    .from("otel_reservations")
    .select("id, guest_name, guest_phone, check_in, check_out, status, total_price, source, pre_checkin_complete, otel_rooms(name)")
    .in("hotel_id", hotelIds)
    .order("check_in", { ascending: true })
    .limit(50);

  return NextResponse.json({ success: true, reservations: rezs || [] });
}
