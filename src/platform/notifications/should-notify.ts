/**
 * shouldNotify — bildirim gönderilmeden önce kullanıcı tercihini ve sessiz
 * saatleri (DND) kontrol eden helper.
 *
 * Kullanım (cron / event handler içinde):
 *   import { shouldNotify } from "@/platform/notifications/should-notify";
 *   if (!await shouldNotify(userId, "sabah_brif")) continue;
 *   await sendText(phone, ...);
 *
 * Tasarım kararları:
 * - Toggle preferences `notification_preferences` table'ında, hızlı lookup.
 * - DND sessiz saatleri profiles.metadata.notifications.dnd JSON'ında
 *   ({ enabled, start: "23:00", end: "08:00", timezone? }).
 * - Saat dilimi şimdilik "Europe/Istanbul" (Türkiye saati), kullanıcı tz'i
 *   ileride profile.metadata.timezone'a eklenince oradan okunur.
 *
 * Entegrasyon planı (bu turda yapılmadı, ayrı tur):
 * - src/lib/cron/tenant-briefings.ts → sabah_brif, takip_sabah_yeni_ilan
 * - src/lib/cron/calendar-reminders.ts → randevu_hatirla
 * - /api/musteri/save POST handler → yeni_musteri_kayit
 * - /api/sozlesme/save → sozlesme_imzali
 * - /api/sunum/* → sunum_acildi
 * - /api/destek/* → destek_yanit
 * vs.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import type { NotificationType } from "./types";

interface DndConfig {
  enabled?: boolean;
  start?: string; // "HH:MM"
  end?: string;   // "HH:MM"
  timezone?: string;
}

interface NotificationsMetadata {
  dnd?: DndConfig;
  preset?: string;
}

/**
 * Kullanıcının verilen bildirim türü için tercihi açık mı + DND saati değil mi?
 * @returns true ise bildirim gönderilebilir, false ise atla.
 */
export async function shouldNotify(
  userId: string,
  type: NotificationType,
  channel: string = "wa",
): Promise<boolean> {
  const sb = getServiceClient();

  // 1) Preference check
  const { data: pref } = await sb
    .from("notification_preferences")
    .select("enabled")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("channel", channel)
    .maybeSingle();

  // Kayıt yoksa default'a düş — Free types için açık varsay (defansif:
  // yeni kullanıcı henüz bildirimler sayfasını açmadıysa Free akış bozulmasın).
  if (!pref) {
    const { isFreeType } = await import("./types").then(m => ({
      isFreeType: m.NOTIFICATION_TYPE_MAP[type]?.tier === "free",
    }));
    return isFreeType;
  }
  if (!pref.enabled) return false;

  // 2) DND check
  const { data: profile } = await sb
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .single();
  const meta = (profile?.metadata as Record<string, unknown> | null) || {};
  const notifMeta = (meta.notifications as NotificationsMetadata | undefined) || {};
  const dnd = notifMeta.dnd;

  if (dnd?.enabled && dnd.start && dnd.end) {
    if (isWithinDnd(dnd.start, dnd.end, dnd.timezone || "Europe/Istanbul")) {
      return false;
    }
  }

  return true;
}

/**
 * Şu anki saat DND aralığında mı?
 * start/end "HH:MM" formatında. start > end ise gece-aşımı (örn 23:00-08:00)
 * destekler.
 */
function isWithinDnd(start: string, end: string, timezone: string): boolean {
  const now = new Date();
  // Intl ile timezone'da saat dilimini yakala
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const curMin = tzNow.getHours() * 60 + tzNow.getMinutes();

  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);
  const sMin = sH * 60 + sM;
  const eMin = eH * 60 + eM;

  if (sMin === eMin) return false; // aralık yok
  if (sMin < eMin) {
    // Aynı gün içi (örn 14:00-18:00)
    return curMin >= sMin && curMin < eMin;
  }
  // Gece-aşımı (örn 23:00-08:00)
  return curMin >= sMin || curMin < eMin;
}
