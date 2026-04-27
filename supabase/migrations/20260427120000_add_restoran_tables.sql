-- ──────────────────────────────────────────────────────────────────────────
-- Restoran SaaS — Tenant tables
-- ──────────────────────────────────────────────────────────────────────────
-- 7. SaaS dikey: Restoran / cafe / catering. Tüm tablolar `rst_` prefix'li,
-- her birinde tenant_id FK'si var. RLS policy'leri Supabase dashboard'da
-- ayrıca konfigüre edilir (mevcut SaaS'lardakiyle aynı pattern).
-- ──────────────────────────────────────────────────────────────────────────

-- ── Masalar ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  label TEXT NOT NULL,                  -- "1", "A2", "Bahçe-3"
  capacity INT,                         -- kişi kapasitesi
  zone TEXT,                            -- "Bahçe", "İç Salon", "Teras"
  status TEXT NOT NULL DEFAULT 'free',  -- free / occupied / reserved / cleaning
  current_check_amount NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rst_tables_tenant_label UNIQUE (tenant_id, label)
);

CREATE INDEX IF NOT EXISTS idx_rst_tables_tenant_status
  ON rst_tables(tenant_id, status) WHERE is_active = TRUE;

-- ── Menü kalemleri ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                        -- "Ana Yemek", "İçecek", "Tatlı"
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2),                   -- maliyet (reçete bazlı kar analizi için)
  is_available BOOLEAN NOT NULL DEFAULT TRUE,  -- günlük tükendi flag
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  prep_minutes INT,                     -- ortalama hazırlık süresi

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_menu_tenant_category
  ON rst_menu_items(tenant_id, category) WHERE is_active = TRUE;

-- ── Stok kalemleri (mutfak hammadde + içecek) ────────────────────────────
CREATE TABLE IF NOT EXISTS rst_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  unit TEXT,                            -- kg, lt, adet, paket
  quantity NUMERIC(10,3) NOT NULL DEFAULT 0,
  low_threshold NUMERIC(10,3),          -- bu seviyenin altında 🔴 kritik
  supplier_name TEXT,
  supplier_phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_inventory_tenant_low
  ON rst_inventory(tenant_id, quantity) WHERE is_active = TRUE;

-- ── Siparişler ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  order_number TEXT NOT NULL,
  table_id UUID REFERENCES rst_tables(id) ON DELETE SET NULL,
  table_label TEXT,                     -- denormalized snapshot
  order_type TEXT NOT NULL DEFAULT 'dine_in',  -- dine_in / takeaway / delivery
  status TEXT NOT NULL DEFAULT 'new',   -- new / preparing / ready / served / paid / cancelled

  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,

  guest_count INT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  served_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rst_orders_tenant_number UNIQUE (tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_rst_orders_tenant_status
  ON rst_orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rst_orders_table
  ON rst_orders(table_id) WHERE status IN ('new','preparing','ready','served');

-- ── Sipariş kalemleri ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES rst_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES rst_menu_items(id) ON DELETE SET NULL,

  item_name TEXT NOT NULL,              -- denormalized snapshot
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,                           -- "az pişmiş", "sossuz"
  status TEXT NOT NULL DEFAULT 'new',   -- new / preparing / ready / served / cancelled

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_order_items_order ON rst_order_items(order_id);

-- ── Rezervasyonlar ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  party_size INT NOT NULL DEFAULT 1,
  reserved_at TIMESTAMPTZ NOT NULL,     -- rezervasyon başlangıç tarihi+saati
  duration_minutes INT NOT NULL DEFAULT 90,

  table_id UUID REFERENCES rst_tables(id) ON DELETE SET NULL,
  table_label TEXT,                     -- denormalized

  status TEXT NOT NULL DEFAULT 'pending',  -- pending / confirmed / seated / completed / cancelled / no_show
  source TEXT,                             -- "wa", "phone", "walk_in", "google"
  notes TEXT,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_reservations_tenant_date
  ON rst_reservations(tenant_id, reserved_at);
CREATE INDEX IF NOT EXISTS idx_rst_reservations_status
  ON rst_reservations(tenant_id, status, reserved_at);
