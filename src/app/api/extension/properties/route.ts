import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

async function getUserId(token: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("extension_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .single();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data.user_id;
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, type, listing_type, price, area, rooms, location_district, location_city")
    .eq("user_id", userId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!properties?.length) return NextResponse.json({ properties: [] });

  const propIds = properties.map(p => p.id);
  const { data: photos } = await supabase
    .from("emlak_property_photos")
    .select("property_id")
    .in("property_id", propIds);

  const countMap: Record<string, number> = {};
  if (photos) {
    for (const p of photos) countMap[p.property_id] = (countMap[p.property_id] || 0) + 1;
  }

  return NextResponse.json({
    properties: properties.map(p => ({ ...p, photo_count: countMap[p.id] || 0 })),
  });
}
