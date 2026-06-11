/**
 * Depo (warehouse) stok iş mantığı — Faz 5.
 *
 * TÜM stok mutasyonları (mal kabul, transfer bacakları, sayım düzeltmesi)
 * bu modülden geçer. Tek choke-point:
 *   1. bayi_warehouse_stock satırını upsert eder (depo × ürün kantite)
 *   2. bayi_stock_movements'a hareket/audit kaydı atar (reuse, +warehouse_id)
 *   3. bayi_products.stock_quantity = tüm depolardaki toplam (sipariş/katalog
 *      backward-compat — eski akış stock_quantity okur)
 *   4. min (low_stock_threshold) altına düşerse Faz 4 olay motoruyla
 *      "dagitici_kritik_stok" eventi tetikler (in-app + WA-mock)
 *
 * Negatif stok engellenir (max(0, ...)). Movement.quantity her zaman pozitif;
 * yön movement_type ('in'/'out'/'adjust') + reference_type ile taşınır.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MovementType = "in" | "out" | "adjust";

export interface StockChangeArgs {
  tenantId: string;
  warehouseId: string;
  productId: string;
  /** İmzalı değişim: +giriş / −çıkış. adjust için yeni−eski farkı. */
  delta: number;
  movementType: MovementType;
  reason?: string | null;
  referenceType?: string | null; // 'receiving' | 'transfer' | 'stocktake' | ...
  referenceId?: string | null;
  createdBy?: string | null;
  unitCost?: number | null;
}

export interface StockChangeResult {
  warehouseQty: number;
  productTotal: number;
  belowMin: boolean;
  aboveMax: boolean;
  productName: string | null;
  minThreshold: number | null;
  maxThreshold: number | null;
}

/**
 * Bir depodaki ürün stoğunu delta kadar değiştir, hareket kaydı at, ürün
 * toplamını senkronla, eşik kontrol et. Eşik altına düşerse event tetikler.
 */
export async function applyStockChange(
  sb: SupabaseClient,
  args: StockChangeArgs,
): Promise<StockChangeResult> {
  const { tenantId, warehouseId, productId, delta } = args;

  // 1) Mevcut depo stoğu
  const { data: existing } = await sb
    .from("bayi_warehouse_stock")
    .select("id, quantity")
    .eq("tenant_id", tenantId)
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();

  const current = existing ? Number(existing.quantity) || 0 : 0;
  const warehouseQty = Math.max(0, current + delta);

  // 2) Upsert depo stoğu
  if (existing) {
    await sb
      .from("bayi_warehouse_stock")
      .update({ quantity: warehouseQty, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await sb.from("bayi_warehouse_stock").insert({
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: productId,
      quantity: warehouseQty,
    });
  }

  // 3) Hareket/audit kaydı (mevcut tablo reuse)
  await sb.from("bayi_stock_movements").insert({
    tenant_id: tenantId,
    warehouse_id: warehouseId,
    product_id: productId,
    movement_type: args.movementType,
    quantity: Math.abs(delta),
    reason: args.reason ?? null,
    reference_type: args.referenceType ?? null,
    reference_id: args.referenceId ?? null,
    unit_cost: args.unitCost ?? null,
    created_by: args.createdBy ?? null,
  });

  // 4) Ürün toplamını tüm depolardan yeniden hesapla (backward-compat)
  const { data: allStock } = await sb
    .from("bayi_warehouse_stock")
    .select("quantity")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId);
  const productTotal = (allStock ?? []).reduce(
    (s, r) => s + (Number(r.quantity) || 0),
    0,
  );

  // 5) Ürün bilgisi + eşikler
  const { data: prod } = await sb
    .from("bayi_products")
    .select("name, low_stock_threshold, max_stock_threshold")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();

  await sb
    .from("bayi_products")
    .update({ stock_quantity: productTotal, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", productId);

  const minThreshold =
    prod?.low_stock_threshold != null ? Number(prod.low_stock_threshold) : null;
  const maxThreshold =
    prod?.max_stock_threshold != null ? Number(prod.max_stock_threshold) : null;
  const belowMin = minThreshold != null && productTotal <= minThreshold;
  const aboveMax = maxThreshold != null && productTotal >= maxThreshold;

  return {
    warehouseQty,
    productTotal,
    belowMin,
    aboveMax,
    productName: (prod?.name as string) ?? null,
    minThreshold,
    maxThreshold,
  };
}

/**
 * Stok değişimi sonrası min eşiği altına düştüyse kritik-stok eventi tetikle.
 * Çağıran applyStockChange sonucunu verir; bu helper event'i (Faz 4
 * dispatcher) ateşler. Asla throw etmez — stok işlemini bloklamaz.
 */
export async function maybeEmitStockAlert(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    warehouseId: string;
    productId: string;
    result: StockChangeResult;
  },
): Promise<void> {
  if (!args.result.belowMin) return;
  try {
    const { emitWarehouseCriticalStockEvent } = await import(
      "@/platform/bayi/events/dispatcher"
    );
    await emitWarehouseCriticalStockEvent(sb, {
      tenantId: args.tenantId,
      warehouseId: args.warehouseId,
      productId: args.productId,
      productName: args.result.productName || "Ürün",
      currentQuantity: args.result.productTotal,
      threshold: args.result.minThreshold ?? 0,
    });
  } catch (err) {
    console.error("[warehouse:stock-alert]", err);
  }
}

/** Tenant'ın default deposunu (yoksa ilk aktif) döner. */
export async function getDefaultWarehouseId(
  sb: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("bayi_warehouses")
    .select("id, is_default")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string) || null;
}
