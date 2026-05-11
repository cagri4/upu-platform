/**
 * /api/destek/[id] — ticket detayı + thread mesajları.
 * Sadece owner görür (cookie session uid === ticket.user_id).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const ticketId = parseInt(id, 10);
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: ticket } = await sb
    .from("support_tickets")
    .select("id, subject, status, created_at, updated_at, user_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket || ticket.user_id !== auth.userId) {
    return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  }

  const { data: messages } = await sb
    .from("support_messages")
    .select("id, sender_type, message, created_at")
    .eq("ticket_id", ticketId)
    .eq("internal_note", false)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    success: true,
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
    },
    messages: messages || [],
  });
}
