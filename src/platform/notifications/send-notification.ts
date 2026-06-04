/**
 * sendNotification — unified bildirim gönderim helper'ı.
 *
 * Akış:
 * 1. shouldNotify(userId, type) ile kullanıcı tercihi + DND kontrol
 * 2. Pro-only türler için isPro(userId) kontrolü
 * 3. notifications tablosuna log insert (kalıcı geçmiş)
 * 4. WA gönderim — 24h pencere AWARE:
 *    a) Window AÇIK → sendButtons (interactive — mevcut davranış)
 *    b) Window KAPALI + type mapping + APPROVED template → sendTemplateByName
 *    c) Window KAPALI + type mapping + template PENDING → DB flag (resend için)
 *    d) Window KAPALI + mapping YOK → silent (sadece DB log)
 * 5. channels_sent array'i güncelle (db, wa, wa-template, wa-pending, wa-failed)
 *
 * Pencere kaynağı: saas_active_session.updated_at (router her inbound'da
 * upsert eder). Profile.whatsapp_phone yoksa hiç gönderim denenmez.
 */
import { getServiceClient } from "@/platform/auth/supabase";
import {
  sendButtons,
} from "@/platform/whatsapp/send";
import {
  APPROVED_NOTIFICATION_TEMPLATES,
  CS_WINDOW_MS,
  lastInboundAt,
  sendTemplateByName,
  type WaLang,
} from "@/platform/whatsapp/templates";
import { shouldNotify } from "./should-notify";
import { isPro } from "@/platform/billing/is-pro";
import {
  NOTIFICATION_TYPE_MAP,
  NOTIFICATION_TYPE_TEMPLATES,
  type NotificationType,
} from "./types";

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
  /**
   * Window kapalıysa template path için tenant info. Opsiyonel;
   * yoksa profile.tenant_id → tenants tablosundan resolve denenir.
   */
  tenantName?: string;
  /** Tam URL (https://...). Yoksa click_target + default tenant host birleştirilir. */
  panelUrl?: string;
  lang?: WaLang;
}

export interface NotificationResult {
  notification_id: number | null;
  channels: string[];
  skipped?: "pref" | "tier" | "error";
}

// tenant_key → primary host (DOMAIN_MAP reverse; manuel guard altında).
// templates.ts'den okumak yerine inline tutuldu — send-notification
// dışındaki yerlerin tenant resolve etmesi zorunlu değil.
const TENANT_HOST: Record<string, string> = {
  bayi: "retailai.upudev.nl",
  emlak: "estateai.upudev.nl",
  muhasebe: "accountai.upudev.nl",
  otel: "hotelai.upudev.nl",
  siteyonetim: "residenceai.upudev.nl",
  market: "marketai.upudev.nl",
  restoran: "restoranai.upudev.nl",
};

const TENANT_LABEL: Record<string, string> = {
  bayi: "Bayi",
  emlak: "Emlak",
  muhasebe: "Muhasebe",
  otel: "Otel",
  siteyonetim: "Site Yönetimi",
  market: "Market",
  restoran: "Restoran",
};

/** click_target relative ise host ile birleştir; absolute ise olduğu gibi. */
export function resolvePanelUrl(host: string | null, target: string | undefined | null): string {
  if (!target) return host ? `https://${host}/` : "";
  if (/^https?:\/\//.test(target)) return target;
  if (!host) return target;
  const path = target.startsWith("/") ? target : `/${target}`;
  return `https://${host}${path}`;
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

  // 4. WA gönder — window-aware
  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("whatsapp_phone, tenant_id")
      .eq("id", input.userId)
      .single();
    const phone = profile?.whatsapp_phone as string | undefined;
    if (!phone) {
      return { notification_id: notifId, channels };
    }

    const last = await lastInboundAt(phone);
    const windowOpen = last !== null && Date.now() - last < CS_WINDOW_MS;

    if (windowOpen) {
      // PATH A — Interactive buttons (mevcut davranış, regresyon yok)
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
    } else {
      // PATH B/C/D — Window kapalı
      const tplMap = NOTIFICATION_TYPE_TEMPLATES[input.type];
      if (tplMap) {
        if (APPROVED_NOTIFICATION_TEMPLATES.has(tplMap.name)) {
          // PATH B — APPROVED template gönder
          const tenantInfo = await resolveTenantInfo(sb, profile?.tenant_id as string | undefined, input);
          const params = tplMap.buildParams({
            tenantName: tenantInfo.label,
            panelUrl: resolvePanelUrl(tenantInfo.host, input.panelUrl || input.payload?.click_target),
            title: input.title,
            body: input.body,
            payload: input.payload || {},
          });
          const res = await sendTemplateByName(phone, tplMap.name, params, input.lang || "tr");
          channels.push(res.ok ? "wa-template" : "wa-failed");
          if (!res.ok) {
            console.error("[sendNotification] template send failed", tplMap.name, res.error);
          }
        } else {
          // PATH C — PENDING; cron-resend için flag
          channels.push("wa-pending");
          const flaggedPayload = {
            ...(input.payload || {}),
            wa_pending_template: true,
            template_name: tplMap.name,
            pending_since: new Date().toISOString(),
          };
          await sb
            .from("notifications")
            .update({ payload: flaggedPayload })
            .eq("id", notifId);
        }
      }
      // PATH D — mapping yok: silent (channels ['db'] kalır)
    }

    if (channels.length > 1) {
      await sb
        .from("notifications")
        .update({ channels_sent: channels })
        .eq("id", notifId);
    }
  } catch (err) {
    console.error("[sendNotification] WA path err:", err);
    // Silent — DB log var, kullanıcı topbar bell'den görür.
  }

  return { notification_id: notifId, channels };
}

/**
 * Tenant info çözümleme — caller `tenantName`/`panelUrl` doldurduysa onu
 * kullan; yoksa profile.tenant_id → tenants tablosundan key oku, inline
 * TENANT_HOST/TENANT_LABEL map'ten çek. Hiçbir şey çözülemezse generic
 * "UPU" + boş host fallback.
 */
async function resolveTenantInfo(
  sb: ReturnType<typeof getServiceClient>,
  tenantId: string | undefined,
  input: NotificationInput,
): Promise<{ label: string; host: string | null }> {
  if (input.tenantName && input.panelUrl) {
    return { label: input.tenantName, host: null };
  }
  if (!tenantId) {
    return { label: input.tenantName || "UPU", host: null };
  }
  try {
    const { data } = await sb
      .from("tenants")
      .select("key")
      .eq("id", tenantId)
      .maybeSingle();
    const key = (data as { key?: string } | null)?.key;
    if (key) {
      return {
        label: input.tenantName || TENANT_LABEL[key] || "UPU",
        host: TENANT_HOST[key] || null,
      };
    }
  } catch {
    /* ignored — fallback below */
  }
  return { label: input.tenantName || "UPU", host: null };
}
