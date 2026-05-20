-- Faz 1A — Bayi Sipariş Onay Flow + Durum Takibi
--
-- B2B portal sipariş akışı (bayi profile.id → admin onayla/red → durum makinesi).
-- Mevcut bayi_orders tablosu (WA bot komutu içinden admin'in bayi adına kayıt
-- ettiği siparişler, status_id FK + order_number) ayrı yaşar. Bu yeni tablolar
-- portal flow'u için status TEXT enum + dealer_user_id direkt profile.id.

CREATE TABLE IF NOT EXISTS bayi_dealer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','preparing','shipped','delivered',
    'cancelled','rejected'
  )),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dealer_orders_tenant_status ON bayi_dealer_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dealer_orders_dealer ON bayi_dealer_orders(dealer_user_id);

CREATE TABLE IF NOT EXISTS bayi_dealer_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bayi_dealer_orders(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dealer_order_items_order ON bayi_dealer_order_items(order_id);

CREATE TABLE IF NOT EXISTS bayi_dealer_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bayi_dealer_orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id UUID,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dealer_order_status_history ON bayi_dealer_order_status_history(order_id, changed_at);
