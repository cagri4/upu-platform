/**
 * /yanitla — Reply to guest messages
 *
 * Lists unread messages, lets user pick one, then type reply.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, NO_HOTEL_MSG } from "./helpers";

// ── Command entry ───────────────────────────────────────────────────────

export async function handleYanitla(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const supabase = getServiceClient();
  const { data: messages } = await supabase
    .from("otel_guest_messages")
    .select("id, guest_name, guest_phone, content, is_escalation, created_at")
    .eq("hotel_id", hotelId)
    .eq("direction", "inbound")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!messages?.length) {
    await sendButtons(ctx.phone,
      prefix("misafir", "Cevaplanacak mesaj bulunmuyor."),
      [{ id: "cmd:mesajlar", title: "Mesajlar" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
    return;
  }

  await sendList(ctx.phone,
    prefix("misafir", "Yanitlamak istediginiz mesaji secin:"),
    "Mesajlar",
    [{
      title: "Okunmamis Mesajlar",
      rows: messages.map((m: any) => ({
        id: `yanitla_select:${m.id}`,
        title: `${m.guest_name}${m.is_escalation ? " [ACIL]" : ""}`,
        description: m.content.substring(0, 50),
      })),
    }],
  );
}

// ── Step handler ────────────────────────────────────────────────────────

export async function handleYanitlaStep(ctx: WaContext, session: CommandSession): Promise<void> {
  if (session.current_step === "reply_text") {
    const text = ctx.text?.trim();
    if (!text || text.length < 1) {
      await sendText(ctx.phone, "Lutfen yanit metninizi yazin:");
      return;
    }

    const d = session.data;
    const guestName = d.guest_name as string;
    const guestPhone = d.guest_phone as string;
    const messageId = d.message_id as string;

    await sendButtons(ctx.phone,
      prefix("misafir", `*Yanit Onay*\n\n👤 Misafir: ${guestName}\n📱 ${guestPhone}\n\n💬 _${text}_`),
      [
        { id: `yanitla_ok:${messageId}`, title: "Gonder" },
        { id: "yanitla_cancel:", title: "Iptal" },
      ],
    );

    await updateSession(ctx.userId, "confirm", { reply_text: text });
    return;
  }

  await sendText(ctx.phone, "Lutfen yanit yazin veya iptal edin.");
}

// ── Callback handler ────────────────────────────────────────────────────

export async function handleYanitlaCallback(ctx: WaContext, data: string): Promise<void> {
  const supabase = getServiceClient();

  // yanitla_select:<message_id> — Pick message to reply
  if (data.startsWith("yanitla_select:")) {
    const msgId = data.replace("yanitla_select:", "");
    const { data: msg } = await supabase
      .from("otel_guest_messages")
      .select("id, guest_name, guest_phone, content")
      .eq("id", msgId)
      .maybeSingle();

    if (!msg) {
      await sendButtons(ctx.phone, "Mesaj bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    await startSession(ctx.userId, ctx.tenantId, "yanitla", "reply_text");
    await updateSession(ctx.userId, "reply_text", {
      message_id: msgId,
      guest_name: msg.guest_name,
      guest_phone: msg.guest_phone,
    });

    await sendText(ctx.phone,
      prefix("misafir", `*${msg.guest_name}*: "${msg.content}"\n\nYanitinizi yazin:`),
    );
    return;
  }

  // yanitla_ok:<message_id> — Send the reply
  if (data.startsWith("yanitla_ok:")) {
    const msgId = data.replace("yanitla_ok:", "");

    const { data: session } = await supabase
      .from("command_sessions")
      .select("data")
      .eq("user_id", ctx.userId)
      .single();

    if (!session) {
      await endSession(ctx.userId);
      await sendText(ctx.phone, "Oturum suresi doldu.");
      return;
    }

    const d = session.data as Record<string, unknown>;
    const guestPhone = d.guest_phone as string;
    const replyText = d.reply_text as string;
    const hotelId = await getHotelId(ctx.userId, ctx.tenantId);

    // Send WhatsApp message to guest
    try {
      await sendText(guestPhone, replyText);
    } catch (err) {
      console.error("[otel:yanitla] send error:", err);
    }

    // Mark original message as read
    await supabase
      .from("otel_guest_messages")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("id", msgId);

    // Save outbound reply
    await supabase.from("otel_guest_messages").insert({
      hotel_id: hotelId,
      guest_name: d.guest_name,
      guest_phone: guestPhone,
      content: replyText,
      direction: "outbound",
      is_read: true,
    });

    await endSession(ctx.userId);

    await sendButtons(ctx.phone,
      prefix("misafir", `✅ Yanit gonderildi: *${d.guest_name}*`),
      [
        { id: "cmd:mesajlar", title: "Diger Mesajlar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
    return;
  }

  // yanitla_cancel: — Cancel reply
  if (data.startsWith("yanitla_cancel:")) {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, prefix("misafir", "Yanit iptal edildi."), [
      { id: "cmd:mesajlar", title: "Mesajlar" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }
}
