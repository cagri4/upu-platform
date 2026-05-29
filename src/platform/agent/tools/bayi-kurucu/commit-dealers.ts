import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const kurucuCommitDealersTool: ToolDef = {
  name: "kurucu_commit_dealers",
  description: "PREVIEW onaylandıktan sonra bayi listesini DB'ye toplu yazar. rows alanı kurucu_preview_dealers_csv'den geldi gibi olmalı. Kullanıcı NET onay (evet/onaylıyorum/yaz/tamam devam) vermeden çağrılMAMALI. Max 500 satır/çağrı.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      rows: {
        type: "array",
        description: "Yazılacak bayiler — kurucu_preview_dealers_csv'den dönen rows alanı.",
        items: { type: "object" },
      },
      preview_token: { type: "string", description: "Audit için preview çıktısındaki token (opsiyonel)." },
    },
    required: ["rows"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_commit_dealers");
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (rows.length === 0) return { ok: false, error: "rows boş." };
    if (rows.length > 500) return { ok: false, error: "Tek çağrıda max 500 bayi (mevcut: " + rows.length + ")." };

    interface InRow {
      name?: string; phone?: string; contact_name?: string | null;
      city?: string | null; district?: string | null; email?: string | null;
      address_line?: string | null; tax_number?: string | null;
      credit_limit?: number | null; payment_term_days?: number | null;
    }
    const payload: Record<string, unknown>[] = [];
    const skipped: Array<{ index: number; reason: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as InRow;
      const name = String(r.name || "").trim().slice(0, 200);
      const phone = String(r.phone || "").trim().slice(0, 32);
      if (!name || !phone) {
        skipped.push({ index: i, reason: "name/phone eksik" });
        continue;
      }
      payload.push({
        tenant_id: ctx.tenantId,
        user_id: ctx.userId,
        name,
        company_name: name,
        phone,
        contact_name: r.contact_name || null,
        city: r.city || null,
        district: r.district || null,
        country: "TR",
        email: r.email || null,
        address_line: r.address_line || null,
        tax_number: r.tax_number || null,
        credit_limit: typeof r.credit_limit === "number" ? r.credit_limit : null,
        payment_term_days: typeof r.payment_term_days === "number" ? r.payment_term_days : null,
        is_active: true,
        balance: 0,
      });
    }
    if (payload.length === 0) {
      return { ok: false, error: "Geçerli satır bulunamadı.", skipped };
    }
    const { data, error } = await ctx.sb
      .from("bayi_dealers")
      .insert(payload)
      .select("id");
    if (error) return { ok: false, error: error.message, skipped };
    return {
      ok: true,
      inserted: data?.length || 0,
      skipped_count: skipped.length,
      skipped,
      preview_token: input.preview_token || null,
      message: `✅ ${data?.length || 0} bayi eklendi${skipped.length > 0 ? `, ${skipped.length} atlandı` : ""}.`,
    };
  },
};
