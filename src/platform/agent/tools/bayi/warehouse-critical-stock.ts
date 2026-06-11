import { assertTenant, type ToolDef } from "@/platform/agent/types";

/**
 * Faz 5 — Depo: kritik stok raporu (SALT-OKU).
 *
 * Toplam stoğu min eşiğin (low_stock_threshold) altına düşmüş ürünleri,
 * hangi depolarda ne kadar kaldığıyla listeler. "Hangi ürünler kritik
 * stokta?" / "neyi acil sipariş etmeliyim?" sorularına yanıt.
 */
export const warehouseCriticalStockTool: ToolDef = {
  name: "warehouse_critical_stock_report",
  description:
    "Stoğu kritik eşiğin (min) altına düşmüş ürünleri listeler — ürün adı, toplam kalan, eşik ve depo kırılımı. Kullanıcı 'kritik stok', 'neyi sipariş etmeliyim', 'stok azaldı mı' diye sorduğunda kullan.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      warehouse_id: {
        type: "string",
        description: "Opsiyonel — yalnız bu depodaki kritik ürünler için UUID.",
      },
    },
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "warehouse_critical_stock_report");
    const warehouseId = (input.warehouse_id as string | undefined) || null;

    // Min eşiği tanımlı + toplam stok eşik altı ürünler
    const { data: products } = await ctx.sb
      .from("bayi_products")
      .select("id, code, name, stock_quantity, low_stock_threshold")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .not("low_stock_threshold", "is", null);

    const critical = (products ?? []).filter(
      (p) =>
        p.low_stock_threshold != null &&
        Number(p.stock_quantity) <= Number(p.low_stock_threshold),
    );

    if (critical.length === 0) {
      return { critical_count: 0, products: [], message: "Kritik stokta ürün yok." };
    }

    // Depo kırılımı
    const ids = critical.map((p) => p.id as string);
    let stockQuery = ctx.sb
      .from("bayi_warehouse_stock")
      .select("product_id, quantity, warehouse_id, bayi_warehouses(name)")
      .eq("tenant_id", ctx.tenantId)
      .in("product_id", ids);
    if (warehouseId) stockQuery = stockQuery.eq("warehouse_id", warehouseId);
    const { data: stock } = await stockQuery;

    const pick = (raw: unknown): Record<string, unknown> | undefined => {
      const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return arr[0] as Record<string, unknown> | undefined;
    };
    const byProduct = new Map<string, Array<{ warehouse: string; quantity: number }>>();
    for (const s of stock ?? []) {
      const pid = s.product_id as string;
      const arr = byProduct.get(pid) ?? [];
      arr.push({
        warehouse: (pick(s.bayi_warehouses)?.name as string) || "—",
        quantity: Number(s.quantity) || 0,
      });
      byProduct.set(pid, arr);
    }

    return {
      critical_count: critical.length,
      products: critical.map((p) => ({
        code: p.code,
        name: p.name,
        total_remaining: Number(p.stock_quantity) || 0,
        threshold: Number(p.low_stock_threshold) || 0,
        warehouses: byProduct.get(p.id as string) ?? [],
      })),
    };
  },
};
