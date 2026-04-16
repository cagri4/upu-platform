import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("emlak_properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json({ property: data });
}

const EDITABLE = new Set([
  "title", "description", "price", "area", "net_area", "rooms", "floor",
  "total_floors", "building_age", "location_city", "location_district",
  "location_neighborhood", "heating", "parking", "elevator", "balcony", "status",
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const k of Object.keys(body)) if (EDITABLE.has(k)) update[k] = body[k];
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Geçerli alan yok" }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("emlak_properties")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
