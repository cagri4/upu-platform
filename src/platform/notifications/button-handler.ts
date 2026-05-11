/**
 * Notification button handler — WA interactive button reply'larını işler.
 *
 * Button id formatı:
 *   notif_view_<id>  → DB'de is_read=true + payload.click_target panel'e
 *                       magic-link ile yönlendir
 *   notif_ack_<id>   → DB'de is_read=true + "👍" yanıtı (window kayar)
 *
 * Router'a entegre: ctx.interactiveId "notif_" ile başlarsa bu handler
 * çağrılır, true dönerse normal akış durur.
 */
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";
import type { WaContext } from "@/platform/whatsapp/types";

interface NotificationPayload {
  click_target?: string;
  related_entity_id?: string;
  related_entity_type?: string;
  [key: string]: unknown;
}

export async function handleNotificationButton(ctx: WaContext, buttonId: string): Promise<boolean> {
  const match = buttonId.match(/^notif_(view|ack)_(\d+)$/);
  if (!match) return false;

  const action = match[1] as "view" | "ack";
  const notifId = parseInt(match[2], 10);
  const sb = getServiceClient();

  // Bildirimi al + ownership kontrol
  const { data: notif } = await sb
    .from("notifications")
    .select("id, user_id, title, payload, is_read")
    .eq("id", notifId)
    .maybeSingle();

  if (!notif || notif.user_id !== ctx.userId) {
    // Başka kullanıcının bildirimi veya silinmiş — sessizce yoksay
    return true;
  }

  // Okundu işaretle (idempotent)
  if (!notif.is_read) {
    await sb
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notifId);
  }

  if (action === "ack") {
    await sendText(ctx.phone, "👍");
    return true;
  }

  // action === "view" — panel URL'ine yönlendir
  const payload = (notif.payload as NotificationPayload | null) || {};
  const clickTarget = payload.click_target || "/tr/panel";
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

  // Magic-link token mint (panel cookie-aware, ama legacy WA URL flow için
  // token kullanılır — kullanıcı kim cookie kaybetse de açılır)
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const sep = clickTarget.includes("?") ? "&" : "?";
  const url = `${appUrl}${clickTarget}${sep}t=${token}`;
  await sendUrlButton(
    ctx.phone,
    `📂 *${notif.title || "Bildirim"}*\n\nDetay için aşağıdaki butona basın.`,
    "📊 Panelde Aç",
    url,
    { skipNav: true },
  );

  return true;
}
