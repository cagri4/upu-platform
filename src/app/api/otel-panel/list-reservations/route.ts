/**
 * /api/otel-panel/list-reservations — owner'ın hotel scope'undaki son
 * rezervasyonlar. Liste sayfası (otel-rezervasyonlar) bunu çağırır.
 *
 * Token doğrula → otel_user_hotels'tan hotel_id listesi → 50 son rez (oda
 * adı join'li).
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
  if ("error" in lookup) return NextResponse.json({ success: true, reservations: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
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
