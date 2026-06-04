/**
 * WhatsApp Business Template sending helpers
 *
 * 24-saat müşteri penceresi dışında kullanıcıya mesaj göndermek için
 * Meta-onaylı template'leri kullanır.
 *
 * Mevcut onaylı template'ler:
 *  - upu_otp_giris   (AUTHENTICATION, tr/en/nl) — 6 haneli giriş kodu
 *  - upu_panel_erisim (UTILITY, tr/en/nl) — yönetim paneli erişim bağlantısı (magic-link)
 *
 * NOT: panel template adı upu_panel_link DEĞİL upu_panel_erisim. Eski isimde
 * Meta auto-classifier "giriş/güvenli/kişisel bağlantı" auth-sinyali kelimeleri
 * yüzünden INCORRECT_CATEGORY veriyordu. İçerik "yönetim paneli erişimi" olarak
 * yeniden çerçevelendi → UTILITY onayı alındı.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "./send";

const WA_API = "https://graph.facebook.com/v23.0";

export type WaLang = "tr" | "en" | "nl";

// WhatsApp müşteri hizmet penceresi: son inbound mesajdan itibaren 24 saat.
export const CS_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Runtime allowlist — sendTemplateByName burada olmayan ad'ı reddeder.
 * Defense-in-depth: Meta'da PENDING/REJECTED template'i runtime yanlışlıkla
 * kullanmasın diye. Meta dashboard'da APPROVED'a geçen template adı buraya
 * elle eklenir (scripts/check_template_status.py çalıştırıp sonucu yapıştır).
 *
 * Şu an APPROVED:
 *  - upu_otp_giris   (AUTHENTICATION, tr/en/nl)
 *  - upu_panel_erisim (UTILITY, tr/en/nl)
 *
 * PENDING (Meta onayını bekliyor — 2026-05-29 submit):
 *  - upu_yeni_kayit, upu_bekleyen_islem, upu_durum_guncelleme, upu_gunluk_ozet
 */
export const APPROVED_NOTIFICATION_TEMPLATES: ReadonlySet<string> = new Set([
  "upu_otp_giris",
  "upu_panel_erisim",
]);

function getConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  };
}

interface TemplateSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

async function sendTemplate(payload: Record<string, unknown>): Promise<TemplateSendResult> {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp credentials missing" };
  }
  try {
    const res = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const errMsg =
        ((data.error as Record<string, unknown>)?.message as string) ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }
    const messages = data.messages as Array<{ id: string }> | undefined;
    return { ok: true, messageId: messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 6 haneli OTP kodunu kullanıcıya gönderir.
 * Template: upu_otp_giris (AUTHENTICATION).
 * Kullanıcı COPY_CODE button'a basarak kodu kopyalar.
 *
 * @param phone E.164 numara (örn "31644967207")
 * @param code  6 haneli sayısal kod
 * @param lang  Dil kodu (varsayılan "tr")
 */
export async function sendOtpTemplate(
  phone: string,
  code: string,
  lang: WaLang = "tr"
): Promise<TemplateSendResult> {
  return sendTemplate({
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "upu_otp_giris",
      language: { code: lang },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: code }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  });
}

/**
 * Kullanıcıya tenant yönetim paneline erişim bağlantısı (magic-link) gönderir.
 * Template: upu_panel_erisim (UTILITY).
 *
 * @param phone   E.164 numara
 * @param name    Kullanıcı adı            → {{1}}
 * @param tenant  Panel adı (örn "Bayi Paneli") → {{2}}
 * @param link    Magic-link URL           → {{3}}
 * @param ttlHours Link TTL saat olarak (örn "24") → {{4}}
 * @param lang    Dil kodu (varsayılan "tr")
 */
export async function sendPanelLinkTemplate(
  phone: string,
  name: string,
  tenant: string,
  link: string,
  ttlHours: string,
  lang: WaLang = "tr"
): Promise<TemplateSendResult> {
  return sendTemplate({
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "upu_panel_erisim",
      language: { code: lang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: name },
            { type: "text", text: tenant },
            { type: "text", text: link },
            { type: "text", text: ttlHours },
          ],
        },
      ],
    },
  });
}

/**
 * Generic template gönderim — APPROVED allowlist'inde olan template'ler için.
 * Tüm parametreler BODY component'inde {{1}}, {{2}}, ... sırasıyla map edilir.
 *
 * @param phone   E.164
 * @param name    Template adı (APPROVED_NOTIFICATION_TEMPLATES'te olmalı)
 * @param params  Pozisyonel parametreler (sırayla {{1}} {{2}} ...)
 * @param lang    Dil kodu
 * @returns       { ok, messageId? | error? }
 */
export async function sendTemplateByName(
  phone: string,
  name: string,
  params: string[],
  lang: WaLang = "tr",
): Promise<TemplateSendResult> {
  if (!APPROVED_NOTIFICATION_TEMPLATES.has(name)) {
    return { ok: false, error: `Template '${name}' APPROVED allowlist'inde değil` };
  }
  const components: Record<string, unknown>[] = [];
  if (params.length > 0) {
    components.push({
      type: "body",
      parameters: params.map((p) => ({ type: "text", text: String(p) })),
    });
  }
  return sendTemplate({
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name,
      language: { code: lang },
      ...(components.length > 0 ? { components } : {}),
    },
  });
}

/**
 * Son inbound mesaj zamanını döndürür (24h pencere tespiti için).
 * Kaynak: saas_active_session.updated_at (her inbound'da webhook upsert eder).
 * Kayıt yoksa null → pencere DIŞINDA kabul edilir (güvenli taraf: template).
 *
 * `send-notification.ts` window kapalıysa template fallback'ine geçmek için
 * bunu çağırır; export edilmesi için module-level rename.
 */
export async function lastInboundAt(phone: string): Promise<number | null> {
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from("saas_active_session")
      .select("updated_at")
      .eq("phone", phone)
      .maybeSingle();
    const ts = (data as { updated_at?: string } | null)?.updated_at;
    return ts ? new Date(ts).getTime() : null;
  } catch {
    return null;
  }
}

/**
 * Panel erişim bağlantısını AKILLI gönderir:
 *  - 24h müşteri penceresi İÇİNDE → zengin URL button (ücretsiz, native UX)
 *  - 24h DIŞINDA veya bilinmiyorsa → upu_panel_erisim template (her zaman teslim)
 *
 * Proaktif/dışarıdan başlatılan akışlarda (re-engagement, zamanlanmış bildirim)
 * kullanın. Komut yanıtları zaten pencere içindedir; onlarda doğrudan
 * sendUrlButton yeterli.
 *
 * @returns gönderim yolu — "button" | "template"
 */
export async function sendPanelLinkSmart(params: {
  phone: string;
  name: string;
  tenant: string;
  link: string;
  ttlHours: string;
  lang?: WaLang;
  buttonLabel?: string;
  inWindowText?: string;
}): Promise<{ via: "button" | "template"; result?: TemplateSendResult }> {
  const { phone, name, tenant, link, ttlHours } = params;
  const lang = params.lang ?? "tr";

  const last = await lastInboundAt(phone);
  const inWindow = last !== null && Date.now() - last < CS_WINDOW_MS;

  if (inWindow) {
    const text =
      params.inWindowText ??
      `🖥 *${tenant}*\n\nYönetim panelinize erişmek için aşağıdaki bağlantıya tıklayın.`;
    await sendUrlButton(phone, text, params.buttonLabel ?? "🖥 Paneli Aç", link, {
      skipNav: true,
    });
    return { via: "button" };
  }

  const result = await sendPanelLinkTemplate(phone, name, tenant, link, ttlHours, lang);
  return { via: "template", result };
}
