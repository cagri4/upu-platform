-- H-19 fix düzeltmesi — bayi_receive_po_line: "unit_price is ambiguous"
--
-- İlk sürümde RETURNS TABLE OUT parametre adları (product_id, unit_price)
-- tablo kolon adlarıyla çakışıyordu; SELECT ... INTO içinde qualifie edilmemiş
-- unit_price runtime'da "column reference is ambiguous" hatası veriyordu →
-- RPC patlıyor, mal kabul hiç uygulanmıyordu (Δ=0). Tüm kolonları tablo
-- alias'ı (pol) ile qualifie ederek çözülür. CREATE OR REPLACE — idempotent.

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
  SELECT pol.received_qty, pol.quantity, pol.product_id, pol.unit_price
    INTO v_before, v_qty, v_prod, v_price
  FROM public.bayi_purchase_order_lines pol
  WHERE pol.id = p_line AND pol.tenant_id = p_tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_after := LEAST(v_qty, v_before + GREATEST(0, COALESCE(p_recv, 0)));

  IF v_after <> v_before THEN
    UPDATE public.bayi_purchase_order_lines pol
    SET received_qty = v_after, updated_at = NOW()
    WHERE pol.id = p_line AND pol.tenant_id = p_tenant;
  END IF;

  RETURN QUERY SELECT (v_after - v_before), v_after, v_qty, v_prod, v_price;
END;
$$;
