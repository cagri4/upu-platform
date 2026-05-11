/**
 * /api/admin/tickets/[id]/reply — admin yanıt yazar.
 *
 * Body: { message, internal_note? }
 * - internal_note=true ise sadece admin görür (RLS user'a göstermez)
 * - status='replied' (regular reply)
 * - User'a WA bildirim (shouldNotify(userId, 'destek_yanit') gate)
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";
import { shouldNotify } from "@/platform/notifications/should-notify";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id, 10);
    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
    }

    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const internal = !!body.internal_note;
    if (!message) return NextResponse.json({ error: "Mesaj zorunlu." }, { status: 400 });
    if (message.length > 2000) return NextResponse.json({ error: "Mesaj en fazla 2000 karakter." }, { status: 400 });

    const sb = getServiceClient();
    const { data: ticket } = await sb
      .from("support_tickets")
      .select("id, user_id, subject, status")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });

    await sb.from("support_messages").insert({
      ticket_id: ticketId,
      sender_type: "admin",
      message,
      internal_note: internal,
    });

    if (!internal) {
      // Public yanıt → status='replied'
      await sb
        .from("support_tickets")
        .update({ status: "replied" })
        .eq("id", ticketId);

      after(async () => {
        try {
          const { data: profile } = await sb
            .from("profiles")
            .select("whatsapp_phone")
            .eq("id", ticket.user_id)
            .single();
          const userPhone = profile?.whatsapp_phone as string | undefined;
          if (userPhone && (await shouldNotify(ticket.user_id as string, "destek_yanit"))) {
            const preview = message.length > 1000 ? message.slice(0, 1000) + "…" : message;
            await sendText(
              userPhone,
              `📬 *Destek yanıtı geldi — #${ticketId}*\n\n📋 ${ticket.subject}\n\n${preview}\n\n_Devam etmek için panelinden #${ticketId} talebine yanıt yazabilirsiniz._`,
            );
          }
        } catch (err) {
          console.error("[admin/tickets:reply] WA notify", err);
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/tickets:reply]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
