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
import { getTenantPanelUrl, getTenantPanelPath } from "@/platform/auth/qr";
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

  // Tenant-aware base URL — bayi/market/otel/restoran kullanıcılarının
  // bildirimleri emlak (estateai) subdomain'ine yönlendirmesin diye.
  // 1) click_target zaten full URL ise (https://...) direkt kullan
  // 2) Path ise: user'ın tenant'ından panel base URL + path'ini çöz
  // 3) clickTarget yoksa: tenant default panel path'ine düş ('/tr/panel'
  //    kabulü yok — siteyonetim'de /tr/site, bayi'de /tr/bayi-panel vs.)
  let url: string;
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  // Tenant resolve — payload.click_target hem path hem null senaryolarında lazım
  let tenantKey: string | null = null;
  let baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id")
      .or(`auth_user_id.eq.${ctx.userId},id.eq.${ctx.userId}`)
      .maybeSingle();
    if (profile?.tenant_id) {
      tenantKey = await getTenantKey(profile.tenant_id);
      const panelBase = tenantKey ? getTenantPanelUrl(tenantKey) : null;
      if (panelBase) {
        baseUrl = new URL(panelBase).origin;
      }
    }
  } catch (err) {
    console.warn("[notif-button] tenant resolve fail, fallback:", err);
  }

  // click_target yoksa tenant'a göre default'a düş — '/tr/panel' kullanma
  if (!payload.click_target) {
    console.warn(
      `[notif-button] payload.click_target empty for notif ${notifId} (user ${ctx.userId}, tenant ${tenantKey ?? "unknown"}); falling back to tenant panel path`,
    );
  }
  const clickTarget = payload.click_target || getTenantPanelPath(tenantKey);

  if (/^https?:\/\//i.test(clickTarget)) {
    const sep = clickTarget.includes("?") ? "&" : "?";
    url = `${clickTarget}${sep}t=${token}`;
  } else {
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
