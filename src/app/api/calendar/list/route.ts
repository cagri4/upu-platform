/**
 * /api/calendar/list?t=<token>
 * Kullanıcının takvim olaylarını döner — pending'ler önce, sent'ler sonra.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sb = getServiceClient();
  const { data } = await sb
    .from("emlak_calendar_events")
    .select("id, title, description, scheduled_at, status, sent_at, related_customer_id, related_property_id, created_at")
    .eq("user_id", auth.userId)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true });

  return NextResponse.json({ success: true, events: data || [] });
}
