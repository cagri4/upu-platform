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

/**
 * Satır başına makul stok üst sınırı (H-13). Absürt/taşma değerlerini (örn.
 * 10^13) ve NUMERIC overflow'u engeller. B2B koli envanteri için 10M fazlasıyla
 * yeterli. mal-kabul/transfer/sayım girdileri bunu aşamaz.
 */
export const MAX_STOCK_QTY = 10_000_000;

/** Birim maliyet üst sınırı (H-13) — absürt unit_cost engeli. */
export const MAX_UNIT_COST = 1_000_000_000;

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
  supplierName?: string | null;
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

  // H-12 fix: stok değişimi TEK atomik RPC'de (bayi_apply_stock_change).
  // Eski JS read-modify-write eşzamanlı çağrılarda kayıp güncelleme üretiyordu
  // (10 paralel +10 → 60). RPC içinde ON CONFLICT DO UPDATE quantity = quantity
  // + delta ile DB-level atomic increment; movement + ürün toplamı tek
  // transaction. Tenant scoping (p_tenant) RPC içinde uygulanır (H-14).
  const { data, error } = await sb.rpc("bayi_apply_stock_change", {
    p_tenant: tenantId,
    p_warehouse: warehouseId,
    p_product: productId,
    p_delta: delta,
    p_movement_type: args.movementType,
    p_reason: args.reason ?? null,
    p_reference_type: args.referenceType ?? null,
    p_reference_id: args.referenceId ?? null,
    p_unit_cost: args.unitCost ?? null,
    p_supplier_name: args.supplierName ?? null,
    p_created_by: args.createdBy ?? null,
  });

  if (error) {
    console.error("[warehouse:applyStockChange:rpc]", error);
    throw new Error(`Stok güncellenemedi: ${error.message}`);
  }

  // RPC RETURNS TABLE → tek satırlık dizi
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        warehouse_qty: number | string;
        product_total: number | string;
        product_name: string | null;
        min_threshold: number | string | null;
        max_threshold: number | string | null;
      }
    | undefined;

  const warehouseQty = Number(row?.warehouse_qty ?? 0);
  const productTotal = Number(row?.product_total ?? 0);
  const minThreshold = row?.min_threshold != null ? Number(row.min_threshold) : null;
  const maxThreshold = row?.max_threshold != null ? Number(row.max_threshold) : null;
  const belowMin = minThreshold != null && productTotal <= minThreshold;
  const aboveMax = maxThreshold != null && productTotal >= maxThreshold;

  return {
    warehouseQty,
    productTotal,
    belowMin,
    aboveMax,
    productName: row?.product_name ?? null,
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
