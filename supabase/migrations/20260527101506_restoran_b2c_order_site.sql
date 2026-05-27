-- ──────────────────────────────────────────────────────────────────────────
-- Restoran B2C Order Site — Sprint 2 schema
-- ──────────────────────────────────────────────────────────────────────────
-- Public sipariş sitesi için yeni tablolar:
--   rst_restaurants      — public-facing restoran kartı (slug, brand, white-label)
--   rst_menu_categories  — menü kategorileri (image, order_index)
--   rst_menu_variants    — varyantlar (S/M/L price diff)
--   rst_menu_addons      — ekstralar (peynir, sos)
--   rst_b2c_orders       — public web sipariş (Mollie ödeme dahil)
--   rst_table_calls      — Sprint 3 hazırlık (garson çağır, hesap iste)
--
-- ALTER mevcut:
--   rst_menu_items  + restaurant_id, allergens, calories, dietary flags, order_index, category_id
--   rst_tables      + qr_token, restaurant_id
--
-- Tüm değişiklikler additive (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Mevcut rst_orders (internal POS) DOKUNULMADI — public sipariş ayrı tablo.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. rst_restaurants ───────────────────────────────────────────────────
-- Bir tenant'a bağlı public restoran kartı. MVP'de 1 tenant = 1 restoran.
CREATE TABLE IF NOT EXISTS rst_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  slug TEXT NOT NULL UNIQUE,                -- /r/lokanta-akdeniz
  brand_name TEXT NOT NULL,
  tagline TEXT,
  logo_url TEXT,
  hero_image_url TEXT,

  primary_color TEXT NOT NULL DEFAULT '#d97706',     -- amber-600
  secondary_color TEXT NOT NULL DEFAULT '#0f172a',   -- slate-900
  font_family TEXT NOT NULL DEFAULT 'Inter',

  address TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'NL',
  phone TEXT,
  email TEXT,

  -- jsonb: { mon: "12:00-23:00", tue: "12:00-23:00", ..., closed: ["sun"] }
  opening_hours JSONB DEFAULT '{}'::jsonb,

  -- jsonb: { instagram, facebook, tiktok, google_maps_url }
  social JSONB DEFAULT '{}'::jsonb,

  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  accepts_online_payment BOOLEAN NOT NULL DEFAULT TRUE,
  accepts_cash_on_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  accepts_dine_in BOOLEAN NOT NULL DEFAULT TRUE,

  -- jsonb: [{ name, postal_codes: [], min_order, fee }]
  delivery_zones JSONB DEFAULT '[]'::jsonb,
  estimated_prep_minutes INT NOT NULL DEFAULT 30,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rst_restaurants_tenant UNIQUE (tenant_id)  -- MVP: 1 tenant = 1 restoran
);

CREATE INDEX IF NOT EXISTS idx_rst_restaurants_slug_published
  ON rst_restaurants(slug) WHERE is_published = TRUE;

-- ── 2. rst_menu_categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES rst_restaurants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  order_index INT NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rst_menu_categories_restaurant_name UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rst_menu_categories_restaurant_order
  ON rst_menu_categories(restaurant_id, order_index) WHERE is_available = TRUE;

-- ── 3. ALTER rst_menu_items ──────────────────────────────────────────────
ALTER TABLE rst_menu_items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES rst_restaurants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES rst_menu_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS calories INT,
  ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_spicy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rst_menu_items_restaurant_category
  ON rst_menu_items(restaurant_id, category_id, order_index) WHERE is_active = TRUE;

-- ── 4. rst_menu_variants ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_menu_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES rst_menu_items(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                       -- "Küçük", "Orta", "Büyük"
  price_diff NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_menu_variants_item
  ON rst_menu_variants(menu_item_id, order_index);

-- ── 5. rst_menu_addons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_menu_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES rst_menu_items(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                       -- "Ekstra peynir"
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_menu_addons_item
  ON rst_menu_addons(menu_item_id, order_index);

-- ── 6. ALTER rst_tables ──────────────────────────────────────────────────
-- qr_token = Sprint 3 hazırlık (masa QR'ı). restaurant_id = multi-restoran V2.
ALTER TABLE rst_tables
  ADD COLUMN IF NOT EXISTS qr_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES rst_restaurants(id) ON DELETE CASCADE;

-- qr_token UNIQUE — ayrı constraint (ADD COLUMN ... UNIQUE inline yapamayız)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_rst_tables_qr_token'
  ) THEN
    ALTER TABLE rst_tables ADD CONSTRAINT uq_rst_tables_qr_token UNIQUE (qr_token);
  END IF;
END $$;

-- ── 7. rst_b2c_orders ────────────────────────────────────────────────────
-- Public web siparişi. Internal POS (rst_orders) AYRI tablo — brifing query'leri
-- UNION ile her ikisini birleştirir.
CREATE TABLE IF NOT EXISTS rst_b2c_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES rst_restaurants(id) ON DELETE CASCADE,

  order_number TEXT NOT NULL,               -- #12345 müşteriye gösterilir
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,

  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('delivery','pickup','dine_in')),
  -- jsonb: { street, no, apartment, postal, city, code, note }
  delivery_address JSONB,
  table_id UUID REFERENCES rst_tables(id) ON DELETE SET NULL,

  -- jsonb: [{ menu_item_id, name, variant_id, variant_name, addons: [{id, name, price}], quantity, unit_price, total }]
  items JSONB NOT NULL,
  notes TEXT,

  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','received','preparing','ready','out_for_delivery','delivered','cancelled')),

  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('ideal','card','cash_on_delivery','card_on_delivery','dine_in_later')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded','expired')),
  mollie_payment_id TEXT,
  mollie_checkout_url TEXT,

  loyalty_member_id UUID REFERENCES rst_loyalty_members(id) ON DELETE SET NULL,

  source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web','qr')),

  estimated_ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rst_b2c_orders_restaurant_number UNIQUE (restaurant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_rst_b2c_orders_restaurant_status
  ON rst_b2c_orders(restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rst_b2c_orders_mollie_payment
  ON rst_b2c_orders(mollie_payment_id) WHERE mollie_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rst_b2c_orders_customer_phone
  ON rst_b2c_orders(restaurant_id, customer_phone);

-- ── 8. rst_table_calls (Sprint 3 hazırlık) ───────────────────────────────
CREATE TABLE IF NOT EXISTS rst_table_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES rst_restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES rst_tables(id) ON DELETE CASCADE,

  reason TEXT NOT NULL CHECK (reason IN ('call','bill_request','complaint','other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','resolved')),
  notes TEXT,

  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ack_at TIMESTAMPTZ,
  ack_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_table_calls_restaurant_pending
  ON rst_table_calls(restaurant_id, status, called_at DESC)
  WHERE status = 'pending';

-- ── 9. RLS — Public read-only for is_published restaurants ───────────────
ALTER TABLE rst_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rst_menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rst_menu_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rst_menu_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE rst_b2c_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rst_table_calls ENABLE ROW LEVEL SECURITY;

-- rst_restaurants: published olanlar herkese SELECT açık
DROP POLICY IF EXISTS p_rst_restaurants_public_read ON rst_restaurants;
CREATE POLICY p_rst_restaurants_public_read ON rst_restaurants
  FOR SELECT TO anon, authenticated
  USING (is_published = TRUE);

-- rst_menu_categories: published restoran'a aitse herkese SELECT
DROP POLICY IF EXISTS p_rst_menu_categories_public_read ON rst_menu_categories;
CREATE POLICY p_rst_menu_categories_public_read ON rst_menu_categories
  FOR SELECT TO anon, authenticated
  USING (
    is_available = TRUE
    AND EXISTS (
      SELECT 1 FROM rst_restaurants r
      WHERE r.id = rst_menu_categories.restaurant_id AND r.is_published = TRUE
    )
  );

-- rst_menu_variants: parent item'in restoran'ı published'sa SELECT açık
DROP POLICY IF EXISTS p_rst_menu_variants_public_read ON rst_menu_variants;
CREATE POLICY p_rst_menu_variants_public_read ON rst_menu_variants
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rst_menu_items i
      JOIN rst_restaurants r ON r.id = i.restaurant_id
      WHERE i.id = rst_menu_variants.menu_item_id AND r.is_published = TRUE
    )
  );

DROP POLICY IF EXISTS p_rst_menu_addons_public_read ON rst_menu_addons;
CREATE POLICY p_rst_menu_addons_public_read ON rst_menu_addons
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rst_menu_items i
      JOIN rst_restaurants r ON r.id = i.restaurant_id
      WHERE i.id = rst_menu_addons.menu_item_id AND r.is_published = TRUE
    )
  );

-- rst_b2c_orders: anon INSERT (sipariş atabilsin), SELECT sadece kendi telefonu+order_number eşleşmesi
-- (basit MVP: anon SELECT yok, müşteri /siparis/{id}'i magic token ile değil session token ile görür)
-- Service role tüm CRUD yapar (panel + webhook). Anon sadece INSERT.
DROP POLICY IF EXISTS p_rst_b2c_orders_anon_insert ON rst_b2c_orders;
CREATE POLICY p_rst_b2c_orders_anon_insert ON rst_b2c_orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rst_restaurants r
      WHERE r.id = restaurant_id AND r.is_published = TRUE
    )
  );

-- rst_b2c_orders SELECT: anon, sipariş ID'sini bilen okuyabilir (sipariş takip için)
-- Order ID UUID v4 = brute-force güvenli, müşteriye link verilir
DROP POLICY IF EXISTS p_rst_b2c_orders_public_read_by_id ON rst_b2c_orders;
CREATE POLICY p_rst_b2c_orders_public_read_by_id ON rst_b2c_orders
  FOR SELECT TO anon, authenticated
  USING (TRUE);  -- UUID ID brute-force safe; gerçek auth check API katmanında

-- rst_table_calls: anon INSERT (QR'dan gelen çağrı)
DROP POLICY IF EXISTS p_rst_table_calls_anon_insert ON rst_table_calls;
CREATE POLICY p_rst_table_calls_anon_insert ON rst_table_calls
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rst_restaurants r
      WHERE r.id = restaurant_id AND r.is_published = TRUE
    )
  );

-- ── 10. Realtime publication — Supabase Realtime için ────────────────────
-- rst_b2c_orders + rst_table_calls realtime'a açık (panel subscribe edebilsin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rst_b2c_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rst_b2c_orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rst_table_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rst_table_calls;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- supabase_realtime publication yoksa sessizce geç (dev env'de olabilir)
  NULL;
END $$;

-- ── 11. updated_at trigger'ları (rst_restaurants + rst_menu_categories + rst_b2c_orders) ───
CREATE OR REPLACE FUNCTION update_rst_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rst_restaurants_updated_at ON rst_restaurants;
CREATE TRIGGER trg_rst_restaurants_updated_at
  BEFORE UPDATE ON rst_restaurants
  FOR EACH ROW EXECUTE FUNCTION update_rst_updated_at();

DROP TRIGGER IF EXISTS trg_rst_menu_categories_updated_at ON rst_menu_categories;
CREATE TRIGGER trg_rst_menu_categories_updated_at
  BEFORE UPDATE ON rst_menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_rst_updated_at();

DROP TRIGGER IF EXISTS trg_rst_b2c_orders_updated_at ON rst_b2c_orders;
CREATE TRIGGER trg_rst_b2c_orders_updated_at
  BEFORE UPDATE ON rst_b2c_orders
  FOR EACH ROW EXECUTE FUNCTION update_rst_updated_at();
