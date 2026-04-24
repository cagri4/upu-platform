/**
 * /api/lead-liste/init — validate token + return today's lead list for the user.
 * Does NOT invalidate token (user may re-open panel throughout the day).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token).maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: leads } = await supabase
    .from("emlak_daily_leads")
    .select("source_id, source_url, title, type, listing_type, price, area, rooms, location_neighborhood, owner_name, owner_phone, image_url, listing_date")
    .eq("snapshot_date", today)
    .order("created_at", { ascending: true });

  const { data: calls } = await supabase
    .from("emlak_lead_calls")
    .select("source_id, status, note, called_at")
    .eq("user_id", magicToken.user_id);

  const callMap = new Map<string, { status: string; note: string | null; called_at: string }>();
  for (const c of calls || []) {
    callMap.set(c.source_id as string, {
      status: c.status as string,
      note: (c.note as string | null) || null,
      called_at: c.called_at as string,
    });
  }

  return NextResponse.json({
    success: true,
    leads: (leads || []).map(l => ({
      ...l,
      call: callMap.get(l.source_id as string) || null,
    })),
  });
}
