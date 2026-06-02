-- Bayi stok rezervasyonu — race condition fix (2026-06-02, #107)
--
-- Sorun: bayi_dealer_orders/create endpoint'inde stok kontrolü atomik
-- değildi. İki dealer aynı anda son ürünü alabilirdi. Bu migration:
--   1. bayi_stock_reservations tablosu (active|consumed|released|expired)
--   2. bayi_create_dealer_order_v2 RPC — single transaction, FOR UPDATE
--      row lock ile yarış koşulunu önler
--   3. bayi_consume_order_reservations + bayi_release_order_reservations
--      RPC'leri — confirm/cancel/reject sonrası stok hareketleri

-- ── 1. Rezervasyon tablosu ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.bayi_dealer_orders(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_by_user_id UUID
);

-- active rezervasyon SUM'ı per product hızlı sorgulanır
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_active
  ON public.bayi_stock_reservations (product_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order
  ON public.bayi_stock_reservations (order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_tenant
  ON public.bayi_stock_reservations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires
  ON public.bayi_stock_reservations (expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

ALTER TABLE public.bayi_stock_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_stock_reservations;
CREATE POLICY "tenant_isolation" ON public.bayi_stock_reservations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
       WHERE auth_user_id = auth.uid()
          OR id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
       WHERE auth_user_id = auth.uid()
          OR id = auth.uid()
    )
  );

-- ── 2. Atomik sipariş create RPC ─────────────────────────────────────
-- Items: jsonb array, her eleman {product_id, product_name, unit_price,
-- quantity, line_total}. product_id NULL ise ad-hoc satır (rezervasyon yok).
--
-- Race condition: PER-PRODUCT FOR UPDATE row lock + aynı transaction
-- içinde reservation insert. İkinci eşzamanlı request lock'a takılır,
-- ilki commit ettiğinde reserved sum güncel sayılır, "insufficient_stock"
-- döner. Tüm function tek transaction — error case'de hiçbir satır
-- yazılmaz.
CREATE OR REPLACE FUNCTION public.bayi_create_dealer_order_v2(
  p_tenant_id UUID,
  p_dealer_user_id UUID,
  p_items JSONB,
  p_notes TEXT,
  p_total NUMERIC,
  p_reservation_ttl_minutes INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id UUID := gen_random_uuid();
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_product_name TEXT;
  v_stock INTEGER;
  v_reserved INTEGER;
  v_available INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_reservation_ttl_minutes > 0 THEN
    v_expires_at := NOW() + (p_reservation_ttl_minutes || ' minutes')::INTERVAL;
  END IF;

  -- Faz 1: TÜM ürünleri kilitle + stok kontrol et. Herhangi biri
  -- yetersizse, hiç bir şey yazmadan hata dön (function-scope rollback).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_product_name := v_item->>'product_name';

    IF v_product_id IS NOT NULL THEN
      SELECT stock_quantity INTO v_stock
        FROM public.bayi_products
       WHERE id = v_product_id AND tenant_id = p_tenant_id
       FOR UPDATE;

      IF v_stock IS NULL THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'product_not_found',
          'product_id', v_product_id,
          'product_name', v_product_name
        );
      END IF;

      SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
        FROM public.bayi_stock_reservations
       WHERE product_id = v_product_id AND status = 'active';

      v_available := v_stock - v_reserved;
      IF v_available < v_qty THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'insufficient_stock',
          'product_id', v_product_id,
          'product_name', v_product_name,
          'available', v_available,
          'requested', v_qty,
          'stock_quantity', v_stock,
          'reserved_total', v_reserved
        );
      END IF;
    END IF;
  END LOOP;

  -- Faz 2: order + items + reservations atomik yazılır.
  INSERT INTO public.bayi_dealer_orders (id, tenant_id, dealer_user_id, status, total_amount, notes)
    VALUES (v_order_id, p_tenant_id, p_dealer_user_id, 'pending', p_total, p_notes);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_line_total := (v_item->>'line_total')::NUMERIC;
    v_product_name := v_item->>'product_name';

    INSERT INTO public.bayi_dealer_order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
      VALUES (v_order_id, v_product_id, v_product_name, v_unit_price, v_qty, v_line_total);

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.bayi_stock_reservations
        (tenant_id, product_id, order_id, quantity, status, created_by_user_id, expires_at)
      VALUES
        (p_tenant_id, v_product_id, v_order_id, v_qty, 'active', p_dealer_user_id, v_expires_at);
    END IF;
  END LOOP;

  INSERT INTO public.bayi_dealer_order_status_history (order_id, old_status, new_status, changed_by_user_id)
    VALUES (v_order_id, NULL, 'pending', p_dealer_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'total', p_total
  );
END;
$$;

-- ── 3. Onay sonrası rezervasyonları stoğa düşür ──────────────────────
-- Confirm akışında çağrılır: active → consumed, stock_quantity decrement,
-- movements log. transitionOrderStatus başarılı olduktan SONRA çağrılır.
CREATE OR REPLACE FUNCTION public.bayi_consume_order_reservations(
  p_order_id UUID,
  p_changed_by_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_consumed INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, product_id, tenant_id, quantity
      FROM public.bayi_stock_reservations
     WHERE order_id = p_order_id AND status = 'active'
     FOR UPDATE
  LOOP
    UPDATE public.bayi_products
       SET stock_quantity = stock_quantity - r.quantity,
           updated_at = NOW()
     WHERE id = r.product_id;

    INSERT INTO public.bayi_stock_movements
      (tenant_id, product_id, movement_type, quantity, reason, reference_id, reference_type, created_by)
    VALUES
      (r.tenant_id, r.product_id, 'out', r.quantity, 'order_confirmed', p_order_id, 'bayi_dealer_orders', p_changed_by_user_id);

    UPDATE public.bayi_stock_reservations
       SET status = 'consumed',
           consumed_at = NOW()
     WHERE id = r.id;

    v_consumed := v_consumed + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'consumed_count', v_consumed);
END;
$$;

-- ── 4. İptal/red sonrası rezervasyonları serbest bırak ───────────────
CREATE OR REPLACE FUNCTION public.bayi_release_order_reservations(
  p_order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_released INTEGER;
BEGIN
  UPDATE public.bayi_stock_reservations
     SET status = 'released',
         released_at = NOW()
   WHERE order_id = p_order_id AND status = 'active';

  GET DIAGNOSTICS v_released = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'released_count', v_released);
END;
$$;

-- ── 5. Service role çağırabilir, anon değil (RLS bypass'a paralel) ───
-- PostgREST default: function authenticated rolüne ait. service_role'a
-- da GRANT verelim.
GRANT EXECUTE ON FUNCTION public.bayi_create_dealer_order_v2(UUID, UUID, JSONB, TEXT, NUMERIC, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.bayi_consume_order_reservations(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.bayi_release_order_reservations(UUID) TO service_role;
