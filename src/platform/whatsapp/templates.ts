/**
 * WhatsApp Business Template sending helpers
 *
 * 24-saat müşteri penceresi dışında kullanıcıya mesaj göndermek için
 * Meta-onaylı template'leri kullanır.
 *
 * Mevcut onaylı template'ler:
 *  - upu_otp_giris (AUTHENTICATION, tr/en/nl) — 6 haneli giriş kodu
 *  - upu_panel_link (UTILITY, tr/en/nl) — magic-link bağlantısı  [pending: kategori revizyonu bekliyor]
 */

const WA_API = "https://graph.facebook.com/v23.0";

export type WaLang = "tr" | "en" | "nl";

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
 * Kullanıcıya tenant paneline magic-link gönderir.
 * Template: upu_panel_link (UTILITY).
 *
 * NOT: Template şu an onay bekliyor. INCORRECT_CATEGORY hatası alındığı için
 * MARKETING kategorisine geçilebilir veya body text revize edilebilir.
 *
 * @param phone   E.164 numara
 * @param name    Kullanıcı adı
 * @param tenant  Panel adı (örn "Bayi Paneli")
 * @param link    Magic-link URL (kısa, güvenli)
 * @param ttlHours Link TTL saat olarak (örn "24")
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
      name: "upu_panel_link",
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
