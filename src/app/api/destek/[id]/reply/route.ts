/**
 * /api/destek/[id]/reply — kullanıcı talebe follow-up mesaj yazar.
 * Status 'open'a döner (yeniden yanıt bekleniyor).
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

const ADMIN_PHONES = (process.env.ADMIN_PHONE || "905066806262")
  .split(",")
  .map(p => p.trim())
  .filter(Boolean);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await req.json();
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const ticketId = parseInt(id, 10);
    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
    }

    const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
    if (messageRaw.length === 0) {
      return NextResponse.json({ error: "Mesaj zorunlu." }, { status: 400 });
    }
    if (messageRaw.length > 2000) {
      return NextResponse.json({ error: "Mesaj en fazla 2000 karakter." }, { status: 400 });
    }

    const sb = getServiceClient();
    const userId = auth.userId;

    const { data: ticket } = await sb
      .from("support_tickets")
      .select("id, user_id, status, subject")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket || ticket.user_id !== userId) {
      return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
    }

    await sb.from("support_messages").insert({
      ticket_id: ticketId,
      sender_type: "user",
      sender_id: userId,
      message: messageRaw,
    });

    // Yeniden açık — yanıt bekleniyor
    if (ticket.status !== "open") {
      await sb
        .from("support_tickets")
        .update({ status: "open" })
        .eq("id", ticketId);
    }

    after(async () => {
      try {
        const preview = messageRaw.length > 150 ? messageRaw.slice(0, 150) + "…" : messageRaw;
        for (const adminPhone of ADMIN_PHONES) {
          await sendText(
            adminPhone,
            `🔔 *Destek #${ticketId} — kullanıcı yanıt yazdı*\n\n📋 ${ticket.subject}\n\n💬 ${preview}\n\n_Yanıt için: \`/destek ${ticketId} mesaj\`_`,
          );
        }
      } catch (err) {
        console.error("[destek:reply] WA notify", err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[destek:reply]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
