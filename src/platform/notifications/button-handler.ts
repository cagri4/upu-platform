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
import { getTenantPanelUrl } from "@/platform/auth/qr";
import { getTenantKey } from "@/platform/cron/briefing-registry";

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

  // Tenant-aware base URL — bayi/market/otel/restoran kullanıcılarının
  // bildirimleri emlak (estateai) subdomain'ine yönlendirmesin diye.
  // 1) click_target zaten full URL ise (https://...) direkt kullan
  // 2) Path ise: user'ın tenant'ından panel base URL'ini çöz
  // 3) Fallback: env APP_URL veya estateai
  let url: string;
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  if (/^https?:\/\//i.test(clickTarget)) {
    // Full URL (yeni pattern — cron tarafı tenant-aware oluşturuyor)
    const sep = clickTarget.includes("?") ? "&" : "?";
    url = `${clickTarget}${sep}t=${token}`;
  } else {
    // Path (legacy) — user tenant'ını çöz
    let baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
    try {
      const { data: profile } = await sb
        .from("profiles")
        .select("tenant_id")
        .or(`auth_user_id.eq.${ctx.userId},id.eq.${ctx.userId}`)
        .maybeSingle();
      if (profile?.tenant_id) {
        const tenantKey = await getTenantKey(profile.tenant_id);
        const panelBase = tenantKey ? getTenantPanelUrl(tenantKey) : null;
        if (panelBase) {
          // panelBase = "https://retailai.upudev.nl/tr/bayi-panel" — origin'ini çıkar
          baseUrl = new URL(panelBase).origin;
        }
      }
    } catch (err) {
      console.warn("[notif-button] tenant resolve fail, fallback:", err);
    }
    const sep = clickTarget.includes("?") ? "&" : "?";
    url = `${baseUrl}${clickTarget}${sep}t=${token}`;
  }
  await sendUrlButton(
    ctx.phone,
    `📂 *${notif.title || "Bildirim"}*\n\nDetay için aşağıdaki butona basın.`,
    "📊 Panelde Aç",
    url,
    { skipNav: true },
  );

  return true;
}
