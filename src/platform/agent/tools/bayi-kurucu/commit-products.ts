import { assertTenant, type ToolDef } from "@/platform/agent/types";
import { randomBytes } from "crypto";

export const kurucuCommitProductsTool: ToolDef = {
  name: "kurucu_commit_products",
  description: "PREVIEW onaylandıktan sonra ürün katalogunu DB'ye toplu yazar. rows kurucu_preview_products_csv'den. Onay alınmadan çağrılMAMALI. Max 500 satır.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      rows: {
        type: "array",
        description: "Yazılacak ürünler — kurucu_preview_products_csv'den dönen rows.",
        items: { type: "object" },
      },
      preview_token: { type: "string", description: "Audit için (opsiyonel)." },
    },
    required: ["rows"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_commit_products");
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (rows.length === 0) return { ok: false, error: "rows boş." };
    if (rows.length > 500) return { ok: false, error: "Tek çağrıda max 500 ürün (mevcut: " + rows.length + ")." };

    interface InRow {
      name?: string; code?: string | null; unit_price?: number;
      category?: string | null; brand?: string | null;
      unit?: string | null; stock_quantity?: number | null;
      description?: string | null;
    }
    const payload: Record<string, unknown>[] = [];
    const skipped: Array<{ index: number; reason: string }> = [];
    const seenCodes = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as InRow;
      const name = String(r.name || "").trim().slice(0, 200);
      const unit_price = Number(r.unit_price);
      if (!name || !isFinite(unit_price) || unit_price < 0) {
        skipped.push({ index: i, reason: !name ? "name eksik" : "unit_price geçersiz" });
        continue;
      }
      let code = r.code ? String(r.code).trim().slice(0, 50) : "";
      if (!code || seenCodes.has(code)) {
        code = `P${randomBytes(3).toString("hex").toUpperCase()}`;
      }
      seenCodes.add(code);
      payload.push({
        tenant_id: ctx.tenantId,
        user_id: ctx.userId,
        name,
        code,
        unit_price,
        base_price: unit_price,
        category: r.category || null,
        brand: r.brand || null,
        unit: r.unit || "adet",
        stock_quantity: typeof r.stock_quantity === "number" ? Math.max(0, r.stock_quantity) : 0,
        description: r.description || null,
        is_active: true,
        min_order: 1,
        low_stock_threshold: 10,
      });
    }
    if (payload.length === 0) {
      return { ok: false, error: "Geçerli satır bulunamadı.", skipped };
    }
    const { data, error } = await ctx.sb
      .from("bayi_products")
      .insert(payload)
      .select("id");
    if (error) return { ok: false, error: error.message, skipped };
    return {
      ok: true,
      inserted: data?.length || 0,
      skipped_count: skipped.length,
      skipped,
      preview_token: input.preview_token || null,
      message: `✅ ${data?.length || 0} ürün eklendi${skipped.length > 0 ? `, ${skipped.length} atlandı` : ""}.`,
    };
  },
};
