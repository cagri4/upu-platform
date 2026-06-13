-- H-19 fix — PO satırı mal kabulü için atomik RPC (over-receive race engeli)
--
-- Faz 7 mal-kabul endpoint'i received_qty'yi JS read-modify-write ile
-- güncelliyordu (snapshot okur → +toReceive yazar). applyStockChange (Faz 5
-- atomik RPC) stok artışını atomik yapsa da, aynı PO satırına eşzamanlı iki
-- istek her ikisi de received_qty=0 okuyup tam miktarı kabul edebiliyordu →
-- stok PO miktarının ÜSTÜNE şişiyordu (kayıp güncelleme + çift mal kabul).
--
-- Bu RPC satırı FOR UPDATE ile kilitleyip received_qty'yi atomik + üst-sınırlı
-- (LEAST(quantity, ...)) artırır ve GERÇEKTEN uygulanan delta'yı döner. Çağıran
-- applyStockChange'i yalnız bu delta kadar çağırır → idempotent: tekrar gelen
-- istek received_qty zaten quantity'de bulur, applied=0, stok değişmez.

CREATE OR REPLACE FUNCTION public.bayi_receive_po_line(
  p_tenant UUID,
  p_line UUID,
  p_recv NUMERIC
)
RETURNS TABLE (
  applied NUMERIC,
  new_received NUMERIC,
  line_qty NUMERIC,
  product_id UUID,
  unit_price NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_before NUMERIC;
  v_qty NUMERIC;
  v_prod UUID;
  v_price NUMERIC;
  v_after NUMERIC;
BEGIN
  -- Satırı tenant kapsamında kilitle (eşzamanlı mal kabulleri serileştirir)
  SELECT received_qty, quantity, public.bayi_purchase_order_lines.product_id, unit_price
    INTO v_before, v_qty, v_prod, v_price
  FROM public.bayi_purchase_order_lines
  WHERE id = p_line AND tenant_id = p_tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN; -- 0 satır → çağıran atlar
  END IF;

  -- Üst sınır: quantity'yi asla aşma; negatif/NaN gelirse 0'a indir
  v_after := LEAST(v_qty, v_before + GREATEST(0, COALESCE(p_recv, 0)));

  IF v_after <> v_before THEN
    UPDATE public.bayi_purchase_order_lines
    SET received_qty = v_after, updated_at = NOW()
    WHERE id = p_line AND tenant_id = p_tenant;
  END IF;

  RETURN QUERY SELECT (v_after - v_before), v_after, v_qty, v_prod, v_price;
END;
$$;
