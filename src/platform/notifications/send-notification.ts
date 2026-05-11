/**
 * sendNotification — unified bildirim gönderim helper'ı.
 *
 * Akış:
 * 1. shouldNotify(userId, type) ile kullanıcı tercihi + DND kontrol
 * 2. Pro-only türler için isPro(userId) kontrolü
 * 3. notifications tablosuna log insert (kalıcı geçmiş)
 * 4. WA'ya interactive buton mesajı (sendButtons header'lı):
 *    - "📊 Panelde Gör" → notif_view_<id>
 *    - "👍 Anladım"     → notif_ack_<id>
 *    User butona basınca 24h window taze tutulur + DB'de is_read=true.
 *    WA hatalı/window kapalıysa silent — DB log her zaman yapılır.
 * 5. channels_sent array'i güncelle (db, wa)
 */
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { shouldNotify } from "./should-notify";
import { isPro } from "@/platform/billing/is-pro";
import { NOTIFICATION_TYPE_MAP, type NotificationType } from "./types";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload?: {
    click_target?: string;
    related_entity_id?: string;
    related_entity_type?: string;
    [key: string]: unknown;
  };
}

export interface NotificationResult {
  notification_id: number | null;
  channels: string[];
  skipped?: "pref" | "tier" | "error";
}

export async function sendNotification(input: NotificationInput): Promise<NotificationResult> {
  const sb = getServiceClient();

  // 1. Tercih + DND
  if (!(await shouldNotify(input.userId, input.type))) {
    return { notification_id: null, channels: [], skipped: "pref" };
  }

  // 2. Pro-only tür kontrolü
  const typeConfig = NOTIFICATION_TYPE_MAP[input.type];
  if (typeConfig?.tier === "pro" && !(await isPro(input.userId))) {
    return { notification_id: null, channels: [], skipped: "tier" };
  }

  // 3. DB insert
  const { data: notif, error: insErr } = await sb
    .from("notifications")
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 4000),
      payload: input.payload || {},
      channels_sent: ["db"],
    })
    .select("id")
    .single();

  if (insErr || !notif) {
    console.error("[sendNotification] DB insert", insErr);
    return { notification_id: null, channels: [], skipped: "error" };
  }

  const notifId = notif.id as number;
  const channels = ["db"];

  // 4. WA gönder — best-effort
  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", input.userId)
      .single();
    const phone = profile?.whatsapp_phone as string | undefined;
    if (phone) {
      const previewBody = input.body.length > 900 ? input.body.slice(0, 900) + "…" : input.body;
      await sendButtons(
        phone,
        previewBody,
        [
          { id: `notif_view_${notifId}`, title: "📊 Panelde Gör" },
          { id: `notif_ack_${notifId}`, title: "👍 Anladım" },
        ],
        { skipNav: true, header: input.title },
      );
      channels.push("wa");
      await sb
        .from("notifications")
        .update({ channels_sent: channels })
        .eq("id", notifId);
    }
  } catch (err) {
    console.error("[sendNotification] WA send (window closed?):", err);
    // Silent — DB log var, kullanıcı topbar bell'den görür.
  }

  return { notification_id: notifId, channels };
}
