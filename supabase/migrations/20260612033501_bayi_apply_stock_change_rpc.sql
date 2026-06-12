-- H-12 fix (Faz 5 cybersec audit) — atomik stok değişimi RPC.
--
-- applyStockChange JS tarafında read-modify-write yapıyordu (SELECT quantity →
-- compute → UPDATE) — transaction/lock yok → eşzamanlı çağrılarda KAYIP
-- GÜNCELLEME (canlı kanıt: 10 paralel +10 → 100 yerine 60). Bu fonksiyon
-- stok değişimini TEK atomik statement'a taşır:
--   ON CONFLICT DO UPDATE SET quantity = quantity + delta  (DB-level atomic
--   increment — eşzamanlı çağrılar birbirini ezemez).
--
-- Fonksiyon tek transaction'da çalışır: upsert (atomik) + movement/audit +
-- ürün toplamı recompute + ürün cache update. warehouse_stock per-depo kantite
-- artık race-safe; bayi_products.stock_quantity denormalize cache (atomik
-- increment kaynağından SUM ile beslenir).
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.bayi_apply_stock_change(
  p_tenant         UUID,
  p_warehouse      UUID,
  p_product        UUID,
  p_delta          NUMERIC,
  p_movement_type  TEXT,
  p_reason         TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id   UUID DEFAULT NULL,
  p_unit_cost      NUMERIC DEFAULT NULL,
  p_supplier_name  TEXT DEFAULT NULL,
  p_created_by     UUID DEFAULT NULL
)
RETURNS TABLE (
  warehouse_qty  NUMERIC,
  product_total  NUMERIC,
  product_name   TEXT,
  min_threshold  NUMERIC,
  max_threshold  NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wh_qty NUMERIC;
  v_total  NUMERIC;
  v_name   TEXT;
  v_min    NUMERIC;
  v_max    NUMERIC;
BEGIN
  -- 1) Atomik upsert — DB-level increment (race-safe)
  INSERT INTO public.bayi_warehouse_stock (tenant_id, warehouse_id, product_id, quantity)
  VALUES (p_tenant, p_warehouse, p_product, GREATEST(0, p_delta))
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET
    quantity   = GREATEST(0, public.bayi_warehouse_stock.quantity + p_delta),
    updated_at = NOW()
  RETURNING quantity INTO v_wh_qty;

  -- 2) Hareket/audit kaydı
  INSERT INTO public.bayi_stock_movements
    (tenant_id, warehouse_id, product_id, movement_type, quantity, reason,
     reference_type, reference_id, unit_cost, supplier_name, created_by)
  VALUES
    (p_tenant, p_warehouse, p_product, p_movement_type, ABS(p_delta), p_reason,
     p_reference_type, p_reference_id, p_unit_cost, p_supplier_name, p_created_by);

  -- 3) Ürün toplamı = tüm depolardaki kantite (denormalize cache)
  SELECT COALESCE(SUM(quantity), 0) INTO v_total
  FROM public.bayi_warehouse_stock
  WHERE tenant_id = p_tenant AND product_id = p_product;

  UPDATE public.bayi_products
  SET stock_quantity = v_total, updated_at = NOW()
  WHERE tenant_id = p_tenant AND id = p_product
  RETURNING name, low_stock_threshold, max_stock_threshold
  INTO v_name, v_min, v_max;

  RETURN QUERY SELECT v_wh_qty, v_total, v_name, v_min, v_max;
END;
$$;
