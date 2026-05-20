import { sendText } from "@/platform/whatsapp/send";
import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const sendDealerMessageTool: ToolDef = {
  name: "send_dealer_message",
  description: "Belirli bir bayiye WhatsApp üzerinden mesaj gönderir (ödeme hatırlatma, sipariş bilgi, vs.). KRİTİK AKSİYON — Kullanıcı her seferinde onay vermeli. Mesajda kullanıcının niyetini kibar Türkçe ile aktarın.",
  expectedTenantKey: "bayi",
  requiresConfirmation: true,
  input_schema: {
    type: "object",
    properties: {
      dealer_id: { type: "string", description: "Hedef bayi profile.id." },
      message: { type: "string", description: "Gönderilecek mesaj metni (Türkçe, kibar)." },
    },
    required: ["dealer_id", "message"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "send_dealer_message");
    if (!["admin", "satis"].includes(ctx.role || "")) {
      return { error: "Bu işlem için yetkiniz yok (admin/satis gerekli)." };
    }
    const dealerId = String(input.dealer_id || "");
    const message = String(input.message || "").trim().slice(0, 1500);
    if (!dealerId || !message) return { error: "dealer_id + message gerekli." };

    const { data: dealer } = await ctx.sb
      .from("profiles")
      .select("whatsapp_phone, display_name, metadata")
      .eq("id", dealerId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!dealer?.whatsapp_phone) {
      return { error: "Bayi bulunamadı veya telefon yok." };
    }

    try {
      await sendText(dealer.whatsapp_phone, message);
      return { sent: true, phone: dealer.whatsapp_phone };
    } catch (err) {
      return { error: "WA gönderimi başarısız: " + (err instanceof Error ? err.message : String(err)) };
    }
  },
};
