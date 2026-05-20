/**
 * /api/otel-panel/list-rooms — owner'ın hotel scope'undaki tüm odalar.
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
  if ("error" in lookup) return NextResponse.json({ success: true, rooms: [] });

  const { data: ouhRows } = await sb.from("otel_user_hotels").select("hotel_id").eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, rooms: [] });

  const { data: rooms } = await sb
    .from("otel_rooms")
    .select("id, name, room_type, bed_type, max_occupancy, base_price, status, sort_order")
    .in("hotel_id", hotelIds)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ success: true, rooms: rooms || [] });
}
