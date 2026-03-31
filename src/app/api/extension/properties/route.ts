import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolveUserId } from "../auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveUserId(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();

  const { data: allProps } = await supabase
    .from("emlak_properties")
    .select("id, title, type, listing_type, price, area, rooms, location_district, location_city")
    .eq("user_id", userId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(20);

  // Only return properties with required fields filled
  const properties = (allProps || []).filter(p =>
    p.title && p.price && p.area && p.rooms && p.location_city && p.location_district,
  );

  if (!properties.length) return NextResponse.json({ properties: [] });

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
