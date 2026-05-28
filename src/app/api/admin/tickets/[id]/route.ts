/**
 * /api/admin/tickets/[id] — admin ticket detayı.
 * Internal note dahil tüm mesajlar döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const ticketId = parseInt(id, 10);
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: ticket } = await sb
    .from("support_tickets")
    .select("id, user_id, subject, status, created_at, updated_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });

  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, whatsapp_phone, email, created_at, metadata")
    .eq("id", ticket.user_id)
    .single();
  const meta = (profile?.metadata as Record<string, unknown> | null) || {};
  const planRaw = meta.plan as string | undefined;

  // Subscription tier
  const { data: sub } = await sb
    .from("subscriptions")
    .select("plan, status, trial_ends_at")
    .eq("user_id", ticket.user_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let tier = "free";
  if (sub) {
    if ((sub.plan === "pro_monthly" || sub.plan === "pro_yearly") && sub.status === "active") tier = "pro";
    else if (sub.plan === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at as string) > new Date()) tier = "trial";
  } else if (planRaw === "pro") {
    tier = "pro";
  }

  const { data: messages } = await sb
    .from("support_messages")
    .select("id, sender_type, sender_id, message, internal_note, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      user_id: ticket.user_id,
    },
    user: {
      id: ticket.user_id,
      name: profile?.display_name || "İsimsiz",
      phone: profile?.whatsapp_phone || null,
      email: profile?.email || null,
      created_at: profile?.created_at || null,
      tier,
    },
    messages: messages || [],
  });
}
