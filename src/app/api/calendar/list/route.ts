/**
 * /api/calendar/list?t=<token>
 * Kullanıcının takvim olaylarını döner — pending'ler önce, sent'ler sonra.
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
    .eq("token", token).maybeSingle();
  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const { data } = await sb
    .from("emlak_calendar_events")
    .select("id, title, description, scheduled_at, status, sent_at, related_customer_id, related_property_id, created_at")
    .eq("user_id", pt.user_id)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true });

  return NextResponse.json({ success: true, events: data || [] });
}
