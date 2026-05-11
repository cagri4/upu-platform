/**
 * /api/destek/init — kullanıcının destek talepleri listesi.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const { data: tickets } = await sb
    .from("support_tickets")
    .select("id, subject, status, created_at, updated_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Her ticket için son mesaj preview'i
  const ids = (tickets || []).map(t => t.id);
  const previewMap = new Map<number, { message: string; sender_type: string; created_at: string }>();
  if (ids.length > 0) {
    const { data: msgs } = await sb
      .from("support_messages")
      .select("ticket_id, message, sender_type, created_at")
      .in("ticket_id", ids)
      .eq("internal_note", false)
      .order("created_at", { ascending: false });
    for (const m of msgs || []) {
      const tid = m.ticket_id as number;
      if (!previewMap.has(tid)) {
        previewMap.set(tid, {
          message: (m.message as string).slice(0, 120),
          sender_type: m.sender_type as string,
          created_at: m.created_at as string,
        });
      }
    }
  }

  const items = (tickets || []).map(t => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    created_at: t.created_at,
    updated_at: t.updated_at,
    last_message: previewMap.get(t.id as number) || null,
  }));

  return NextResponse.json({ success: true, tickets: items });
}
