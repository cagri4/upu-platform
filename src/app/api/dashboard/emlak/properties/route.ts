import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const userId = auth.userId;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("emlak_properties")
    .select("id, title, type, listing_type, price, area, rooms, location_district, location_neighborhood, image_url, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ properties: data || [] });
}
