/**
 * /api/destek/create — yeni destek talebi aç.
 *
 * Body: { subject (≤100), message (≤2000) }
 * - support_tickets + ilk support_messages (sender_type='user') insert
 * - User'a WA: "✅ Talebiniz alındı #<id>"
 * - Admin'e WA: "🛟 Yeni destek #<id> — yanıt: /destek <id> mesaj"
 *
 * TODO: email BCC to destek@upudev.nl — projede email infra yok, sonraki turda
 * eklenecek (Resend/Postmark vb. entegrasyonu sonra).
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
    const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
    if (subjectRaw.length === 0) {
      return NextResponse.json({ error: "Konu zorunlu." }, { status: 400 });
    }
    if (subjectRaw.length > 100) {
      return NextResponse.json({ error: "Konu en fazla 100 karakter olabilir." }, { status: 400 });
    }
    if (messageRaw.length === 0) {
      return NextResponse.json({ error: "Mesaj zorunlu." }, { status: 400 });
    }
    if (messageRaw.length > 2000) {
      return NextResponse.json({ error: "Mesaj en fazla 2000 karakter olabilir." }, { status: 400 });
    }

    const sb = getServiceClient();
    const userId = auth.userId;

    const { data: ticket, error: tErr } = await sb
      .from("support_tickets")
      .insert({ user_id: userId, subject: subjectRaw, status: "open" })
      .select("id")
      .single();
    if (tErr || !ticket) {
      console.error("[destek:create] insert ticket", tErr);
      return NextResponse.json({ error: "Talep oluşturulamadı." }, { status: 500 });
    }

    const ticketId = ticket.id as number;

    const { error: mErr } = await sb
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "user",
        sender_id: userId,
        message: messageRaw,
      });
    if (mErr) {
      console.error("[destek:create] insert message", mErr);
      // Ticket oluştu ama mesaj olmadan kaldı — soft fail
    }

    // Bildirimler (after — response'u bekletmesin)
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, whatsapp_phone")
      .eq("id", userId)
      .single();
    const userPhone = (profile?.whatsapp_phone as string | undefined) || null;
    const userName = (profile?.display_name as string | undefined) || "İsimsiz";

    after(async () => {
      try {
        if (userPhone) {
          await sendText(
            userPhone,
            `✅ *Destek talebiniz alındı*\n\nTalep #${ticketId} — "${subjectRaw}"\n\nEkibimiz 24 saat içinde yanıtlayacak. Yanıt size hem WhatsApp'tan hem panelden gelir.`,
          );
        }
        // Admin'lere bildirim
        const subjectPreview = subjectRaw.length > 60 ? subjectRaw.slice(0, 60) + "…" : subjectRaw;
        const messagePreview = messageRaw.length > 200 ? messageRaw.slice(0, 200) + "…" : messageRaw;
        for (const adminPhone of ADMIN_PHONES) {
          await sendText(
            adminPhone,
            `🛟 *Yeni destek talebi #${ticketId}*\n\n👤 ${userName}${userPhone ? ` (${userPhone})` : ""}\n📋 ${subjectPreview}\n\n💬 ${messagePreview}\n\n_Yanıtlamak için: \`/destek ${ticketId} mesaj\`_`,
          );
        }
      } catch (err) {
        console.error("[destek:create] WA notify", err);
      }
    });

    return NextResponse.json({ success: true, ticket_id: ticketId });
  } catch (err) {
    console.error("[destek:create]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
