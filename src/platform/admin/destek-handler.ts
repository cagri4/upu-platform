/**
 * Destek admin WhatsApp komutları.
 *
 * Komutlar (admin only):
 *   /destek <id> mesaj            — kullanıcıya yanıt yaz, status='replied'
 *   /destek-kapat <id>            — status='resolved'
 *   /destek-liste                 — açık ticket listesi
 *
 * Router'a entegre: text command parsing'in başında çağrılır (admin gate
 * içinde). false döndürürse normal akış devam eder.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";
import { isAdmin } from "@/platform/admin/commands";
import { shouldNotify } from "@/platform/notifications/should-notify";
import type { WaContext } from "@/platform/whatsapp/types";

export async function handleDestekAdminCommand(ctx: WaContext, raw: string): Promise<boolean> {
  const text = raw.trim();
  if (!text.startsWith("/destek")) return false;
  if (!(await isAdmin(ctx))) return false;

  // /destek-kapat <id>
  const closeMatch = text.match(/^\/destek-kapat\s+(\d+)\s*$/);
  if (closeMatch) {
    await closeTicket(ctx, parseInt(closeMatch[1], 10));
    return true;
  }

  // /destek-liste
  if (/^\/destek-liste\s*$/.test(text)) {
    await listOpenTickets(ctx);
    return true;
  }

  // /destek <id> <mesaj>
  const replyMatch = text.match(/^\/destek\s+(\d+)\s+([\s\S]+)$/);
  if (replyMatch) {
    const id = parseInt(replyMatch[1], 10);
    const message = replyMatch[2].trim();
    if (!message) {
      await sendText(ctx.phone, "Mesaj boş olamaz. Format: `/destek <id> <mesaj>`");
      return true;
    }
    await replyTicket(ctx, id, message);
    return true;
  }

  // Tanınmayan format
  if (text.startsWith("/destek")) {
    await sendText(
      ctx.phone,
      "Destek admin komutları:\n• `/destek <id> <mesaj>` — yanıtla\n• `/destek-kapat <id>` — çöz\n• `/destek-liste` — açık talepler",
    );
    return true;
  }
  return false;
}

async function replyTicket(ctx: WaContext, ticketId: number, message: string) {
  const sb = getServiceClient();
  const { data: ticket } = await sb
    .from("support_tickets")
    .select("id, user_id, subject, status")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) {
    await sendText(ctx.phone, `❌ #${ticketId} bulunamadı.`);
    return;
  }

  await sb.from("support_messages").insert({
    ticket_id: ticketId,
    sender_type: "admin",
    sender_id: ctx.userId,
    message,
  });

  await sb
    .from("support_tickets")
    .update({ status: "replied" })
    .eq("id", ticketId);

  // Kullanıcıya WA bildirim — bildirim tercihi honor edilir
  const { data: userProfile } = await sb
    .from("profiles")
    .select("whatsapp_phone")
    .eq("id", ticket.user_id)
    .single();
  const userPhone = userProfile?.whatsapp_phone as string | undefined;

  let notified = false;
  if (userPhone && (await shouldNotify(ticket.user_id as string, "destek_yanit"))) {
    const preview = message.length > 1000 ? message.slice(0, 1000) + "…" : message;
    await sendText(
      userPhone,
      `📬 *Destek yanıtı geldi — #${ticketId}*\n\n📋 ${ticket.subject}\n\n${preview}\n\n_Devam etmek için panelinden #${ticketId} talebine yanıt yazabilirsiniz._`,
    );
    notified = true;
  }

  await sendText(
    ctx.phone,
    `📤 #${ticketId} yanıt gönderildi.${notified ? " (kullanıcıya WA bildirildi)" : " (kullanıcının bildirimleri kapalı veya telefonu yok)"}`,
  );
}

async function closeTicket(ctx: WaContext, ticketId: number) {
  const sb = getServiceClient();
  const { data: ticket } = await sb
    .from("support_tickets")
    .select("id, subject")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) {
    await sendText(ctx.phone, `❌ #${ticketId} bulunamadı.`);
    return;
  }
  await sb
    .from("support_tickets")
    .update({ status: "resolved" })
    .eq("id", ticketId);
  await sendText(ctx.phone, `✅ #${ticketId} çözüldü (${ticket.subject}).`);
}

async function listOpenTickets(ctx: WaContext) {
  const sb = getServiceClient();
  const { data: rows } = await sb
    .from("support_tickets")
    .select("id, subject, status, created_at, user_id")
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (!rows || rows.length === 0) {
    await sendText(ctx.phone, "✅ Açık destek talebi yok.");
    return;
  }

  const userIds = [...new Set(rows.map(r => r.user_id))];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  const nameMap = new Map<string, string>();
  for (const p of profiles || []) nameMap.set(p.id as string, (p.display_name as string) || "İsimsiz");

  let text = `🛟 *Açık Destek Talepleri* (${rows.length})\n\n`;
  for (const r of rows) {
    const date = new Date(r.created_at as string).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    const subject = (r.subject as string).length > 40 ? (r.subject as string).slice(0, 40) + "…" : r.subject;
    text += `*#${r.id}* — ${nameMap.get(r.user_id as string) || "?"}\n  📋 ${subject}\n  📅 ${date}\n\n`;
  }
  text += "_Yanıt için: `/destek <id> <mesaj>`_";

  await sendText(ctx.phone, text);
}
