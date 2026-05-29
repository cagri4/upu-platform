import { assertTenant, type ToolDef } from "@/platform/agent/types";

const SUPPORT_PHONE = "+31644967207";
const SUPPORT_EMAIL = "info@upudev.nl";

export const kurucuRequestWaHandoffTool: ToolDef = {
  name: "kurucu_request_wa_handoff",
  description: "KAÇIŞ KAPISI — kullanıcı zorlanıyorsa, karmaşık liste varsa, ya da 'WhatsApp'tan at biz aktaralım' dediğinde çağır. Destek hattı + e-posta + ön-hazır WA mesajı döner. ASLA döngüye hapsetme; bu tool kullanıcıya nefes verir.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Yardım konusu — 'bayi_listesi' | 'urun_katalogu' | 'genel'",
        enum: ["bayi_listesi", "urun_katalogu", "genel"],
      },
      note: { type: "string", description: "Kullanıcının ek notu (opsiyonel)." },
    },
    required: ["topic"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_request_wa_handoff");
    const topic = String(input.topic || "genel");
    const note = input.note ? String(input.note).slice(0, 500) : "";

    const topicLabel: Record<string, string> = {
      bayi_listesi: "bayi listesi aktarımı",
      urun_katalogu: "ürün katalogu aktarımı",
      genel: "genel kurulum yardımı",
    };
    const label = topicLabel[topic] || "kurulum yardımı";

    const waMessage = [
      `Merhaba, UPU Bayi sistemimde ${label} için yardım rica ediyorum.`,
      `Kullanıcı: ${ctx.displayName || "—"}`,
      `Tenant ID: ${ctx.tenantId.slice(0, 8)}…`,
      note ? `Not: ${note}` : null,
    ].filter(Boolean).join("\n");

    const waLink = `https://wa.me/${SUPPORT_PHONE.replace(/[^\d]/g, "")}?text=${encodeURIComponent(waMessage)}`;
    const mailtoLink = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("UPU Bayi: " + label)}&body=${encodeURIComponent(waMessage)}`;

    return {
      ok: true,
      topic,
      support_phone: SUPPORT_PHONE,
      support_email: SUPPORT_EMAIL,
      wa_link: waLink,
      mailto_link: mailtoLink,
      pre_filled_message: waMessage,
      instruction: "Kullanıcıya 2 seçenek sun: WhatsApp linkini tıklayarak destek hattına yaz, veya e-posta ile gönder. Mesaj zaten hazır — sadece gönder. Süreç: ekip 1 iş günü içinde döner; bu arada sistemi başka açıdan keşfetmeye geçebilir.",
    };
  },
};
