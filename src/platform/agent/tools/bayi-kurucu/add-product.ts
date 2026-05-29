import { assertTenant, type ToolDef } from "@/platform/agent/types";
import { randomBytes } from "crypto";

export const kurucuAddProductTool: ToolDef = {
  name: "kurucu_add_product",
  description: "TEK ürün ekler. name + unit_price zorunlu; code/sku otomatik üretilir yoksa. Onay gerekmez (kullanıcı her alanı verdi).",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Ürün adı (zorunlu)" },
      unit_price: { type: "number", description: "Birim fiyat (zorunlu)" },
      code: { type: "string", description: "Stok kodu (opsiyonel, yoksa otomatik)" },
      category: { type: "string", description: "Kategori (opsiyonel)" },
      brand: { type: "string", description: "Marka (opsiyonel)" },
      unit: { type: "string", description: "Birim (adet/kg/lt vb. — default adet)" },
      stock_quantity: { type: "number", description: "Başlangıç stok (default 0)" },
      description: { type: "string", description: "Açıklama (opsiyonel)" },
    },
    required: ["name", "unit_price"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_add_product");
    const name = String(input.name || "").trim().slice(0, 200);
    const unit_price = Number(input.unit_price);
    if (!name || !isFinite(unit_price) || unit_price < 0) {
      return { ok: false, error: "name ve geçerli unit_price zorunlu." };
    }
    const code = input.code
      ? String(input.code).slice(0, 50)
      : `P${randomBytes(3).toString("hex").toUpperCase()}`;
    const payload = {
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      name,
      code,
      unit_price,
      base_price: unit_price,
      category: input.category ? String(input.category).slice(0, 100) : null,
      brand: input.brand ? String(input.brand).slice(0, 100) : null,
      unit: input.unit ? String(input.unit).slice(0, 20) : "adet",
      stock_quantity: typeof input.stock_quantity === "number" ? Math.max(0, input.stock_quantity) : 0,
      description: input.description ? String(input.description).slice(0, 1000) : null,
      is_active: true,
      min_order: 1,
      low_stock_threshold: 10,
    };
    const { data, error } = await ctx.sb
      .from("bayi_products")
      .insert(payload)
      .select("id, name, code, unit_price")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, product: data, message: `✅ ${data?.name} (${data?.code}) eklendi.` };
  },
};
