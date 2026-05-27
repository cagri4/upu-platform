/**
 * Site SaaS Bildirim Kanal Soyutlaması (Sprint 3 Modül 3).
 *
 * Çağrı 2026-05-27 onayı:
 *   - WA template önce dene (Utility kategorisi, 1-3 gün onay)
 *   - Reddedilirse SMS fallback
 *   - Worker template taslaklarını yazsın, Çağrı Meta'ya başvuracak
 *
 * Provider-agnostic gönderim katmanı — UI tek `dispatchAnnouncement()`
 * çağırır, channel seçimine + provider implementation'a göre router.
 */

export type NotificationChannel = "wa_template" | "sms" | "email" | "push" | "inbox";

export interface NotificationRecipient {
  user_id: string;
  phone: string | null;
  email: string | null;
  display_name: string | null;
}

export interface DispatchRequest {
  building_id: string;
  channels: NotificationChannel[];
  /** WA template adı (Meta onayı sonrası). */
  wa_template_id?: string;
  /** Template değişkenleri ({ad}, {tutar}, {vade} vs.). */
  wa_template_vars?: Record<string, string>;
  /** Body — SMS/email/inbox için. wa_template_vars varsa template render edilir. */
  title: string;
  body: string;
  recipients: NotificationRecipient[];
}

export interface DispatchResult {
  channel: NotificationChannel;
  attempted: number;
  succeeded: number;
  failed: number;
  /** Provider'dan gelen hata mesajları (varsa). */
  errors: string[];
}

export interface NotificationProvider {
  channel: NotificationChannel;
  send(req: DispatchRequest): Promise<DispatchResult>;
}

// ===== Inbox provider — her zaman çalışır =====
// Sakin paneli "Bildirimler" sayfasına yazar (sy_announcement_reads bridge).

export class InboxProvider implements NotificationProvider {
  channel: NotificationChannel = "inbox";

  async send(req: DispatchRequest): Promise<DispatchResult> {
    // Inbox aslında sy_announcements satırının kendisi. Bu provider sadece
    // recipient sayısını döner — gerçek "okundu" sy_announcement_reads ile.
    return {
      channel: "inbox",
      attempted: req.recipients.length,
      succeeded: req.recipients.length,
      failed: 0,
      errors: [],
    };
  }
}

// ===== WA Template provider — Mock (Meta onayı bekliyor) =====
// Çağrı: "Worker WA template taslaklarını yazsın, Meta onayını ben alacağım."

export class WaTemplateMockProvider implements NotificationProvider {
  channel: NotificationChannel = "wa_template";

  async send(req: DispatchRequest): Promise<DispatchResult> {
    if (!req.wa_template_id) {
      return {
        channel: "wa_template",
        attempted: 0,
        succeeded: 0,
        failed: req.recipients.length,
        errors: ["wa_template_id eksik — Meta'da onaylı template seçin."],
      };
    }

    const eligible = req.recipients.filter((r) => r.phone);
    return {
      channel: "wa_template",
      attempted: eligible.length,
      succeeded: eligible.length,
      failed: req.recipients.length - eligible.length,
      errors: req.recipients.length - eligible.length > 0
        ? [`${req.recipients.length - eligible.length} alıcının telefonu yok.`]
        : [],
    };
  }
}

// ===== SMS Mock provider — fallback (TR provider'lar V2) =====

export class SmsMockProvider implements NotificationProvider {
  channel: NotificationChannel = "sms";

  async send(req: DispatchRequest): Promise<DispatchResult> {
    const eligible = req.recipients.filter((r) => r.phone);
    return {
      channel: "sms",
      attempted: eligible.length,
      succeeded: eligible.length,
      failed: req.recipients.length - eligible.length,
      errors: [],
    };
  }
}

// ===== Email Mock provider =====

export class EmailMockProvider implements NotificationProvider {
  channel: NotificationChannel = "email";

  async send(req: DispatchRequest): Promise<DispatchResult> {
    const eligible = req.recipients.filter((r) => r.email);
    return {
      channel: "email",
      attempted: eligible.length,
      succeeded: eligible.length,
      failed: req.recipients.length - eligible.length,
      errors: [],
    };
  }
}

// ===== Router — channels'e göre dispatch =====

const PROVIDERS: Record<NotificationChannel, NotificationProvider> = {
  inbox: new InboxProvider(),
  wa_template: new WaTemplateMockProvider(),
  sms: new SmsMockProvider(),
  email: new EmailMockProvider(),
  // V2: push provider
  push: new InboxProvider(),
};

export async function dispatchAnnouncement(
  req: DispatchRequest,
): Promise<DispatchResult[]> {
  const results = await Promise.all(
    req.channels.map((ch) => PROVIDERS[ch].send(req)),
  );
  return results;
}

// ===== Meta WA Template Taslakları (Çağrı için, V2 onay sonrası deploy) =====
// Sprint 3 brief: 4 template taslağı + Çağrı Meta'ya başvuracak.

export interface WaTemplateDraft {
  /** Template adı — Meta panelinde aynı string. */
  name: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: "tr" | "en" | "nl";
  /** Body text — değişkenler {{1}} {{2}} vs. */
  body: string;
  /** Değişken etiketleri (UI'ye yardımcı). */
  variables: string[];
}

export const SITE_WA_TEMPLATES: WaTemplateDraft[] = [
  {
    name: "aidat_hatirlatma_v1",
    category: "UTILITY",
    language: "tr",
    body:
      "Merhaba {{1}},\n\n{{2}} dönemine ait aidat ödemeniz hâlâ alınmamış.\n" +
      "Tutar: {{3}} ₺\nVade: {{4}}\n\nÖdeme için panele girin: {{5}}\n\n— {{6}}",
    variables: ["ad", "donem", "tutar", "vade", "panel_link", "bina_adi"],
  },
  {
    name: "bakim_duyuru_v1",
    category: "UTILITY",
    language: "tr",
    body:
      "Sayın {{1}},\n\n{{2}} bakımı için tarih ve saat bilgisi:\n" +
      "📅 {{3}}\n🕐 {{4}}\n📍 {{5}}\n\nNot: {{6}}\n\n— {{7}}",
    variables: ["ad", "konu", "tarih", "saat", "yer", "not", "bina_adi"],
  },
  {
    name: "toplanti_cagri_v1",
    category: "UTILITY",
    language: "tr",
    body:
      "Sayın {{1}},\n\n{{2}} Genel Kurul toplantısına davetlisiniz.\n" +
      "📅 {{3}}\n📍 {{4}}\n\nGündem ve katılım için: {{5}}\n\n— {{6}}",
    variables: ["ad", "toplanti_turu", "tarih", "yer", "gundem_link", "bina_adi"],
  },
  {
    name: "ariza_durum_v1",
    category: "UTILITY",
    language: "tr",
    body:
      "Merhaba {{1}},\n\n{{2}} numaralı arıza talebinizin durumu güncellendi:\n" +
      "Durum: {{3}}\nTahmini çözüm: {{4}}\n\nDetay: {{5}}\n\n— {{6}}",
    variables: ["ad", "ticket_no", "durum", "tahmini_zaman", "panel_link", "bina_adi"],
  },
];
