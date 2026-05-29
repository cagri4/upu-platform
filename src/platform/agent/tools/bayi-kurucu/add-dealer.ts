import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const kurucuAddDealerTool: ToolDef = {
  name: "kurucu_add_dealer",
  description: "TEK bayi ekler — kullanıcı her alanı verdikten sonra direkt yazılır (onay gerekmez, kullanıcı zaten girdi). Sadece name + phone zorunlu; diğerleri opsiyonel. country default 'TR'.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Bayi adı / firma adı (zorunlu)" },
      phone: { type: "string", description: "İletişim telefon (zorunlu, +90...)" },
      contact_name: { type: "string", description: "Yetkili kişi adı (opsiyonel)" },
      city: { type: "string", description: "Şehir (opsiyonel)" },
      district: { type: "string", description: "İlçe (opsiyonel)" },
      country: { type: "string", description: "Ülke (default TR)" },
      email: { type: "string", description: "E-posta (opsiyonel)" },
      address_line: { type: "string", description: "Adres satırı (opsiyonel)" },
      tax_number: { type: "string", description: "Vergi no (opsiyonel)" },
      credit_limit: { type: "number", description: "Kredi limiti (opsiyonel)" },
      payment_term_days: { type: "number", description: "Vade gün (opsiyonel)" },
    },
    required: ["name", "phone"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_add_dealer");
    const name = String(input.name || "").trim().slice(0, 200);
    const phone = String(input.phone || "").trim().slice(0, 32);
    if (!name || !phone) {
      return { ok: false, error: "name ve phone zorunlu." };
    }
    const payload = {
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      name,
      company_name: name,
      contact_name: input.contact_name ? String(input.contact_name).slice(0, 200) : null,
      phone,
      city: input.city ? String(input.city).slice(0, 100) : null,
      district: input.district ? String(input.district).slice(0, 100) : null,
      country: input.country ? String(input.country).slice(0, 4) : "TR",
      email: input.email ? String(input.email).slice(0, 200) : null,
      address_line: input.address_line ? String(input.address_line).slice(0, 500) : null,
      tax_number: input.tax_number ? String(input.tax_number).slice(0, 50) : null,
      credit_limit: typeof input.credit_limit === "number" ? input.credit_limit : null,
      payment_term_days: typeof input.payment_term_days === "number" ? input.payment_term_days : null,
      is_active: true,
      balance: 0,
    };
    const { data, error } = await ctx.sb
      .from("bayi_dealers")
      .insert(payload)
      .select("id, name, city")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, dealer: data, message: `✅ ${data?.name} eklendi.` };
  },
};
