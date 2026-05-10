/**
 * /api/takip/init?t=<token>
 * Multi-row (2026-05-08): kullanıcının tüm takiplerini liste olarak döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const supabase = getServiceClient();
  const { data: criteria } = await supabase
    .from("emlak_tracking_criteria")
    .select("id, name, neighborhoods, property_types, listing_type, price_min, price_max, active, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    success: true,
    trackings: criteria || [],
  });
}
