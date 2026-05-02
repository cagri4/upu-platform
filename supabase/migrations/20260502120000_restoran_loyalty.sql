-- ──────────────────────────────────────────────────────────────────────────
-- Restoran SaaS — Loyalty (müdavim) tabloları
-- ──────────────────────────────────────────────────────────────────────────
-- Müşteri = WA-only secondary user pattern (otel guest analoğu).
-- Telefon-bazlı kimlik, opt-in sadakat club.
--
-- Restoran sahibi + personel rst_loyalty_members'a yazar/okur (service-role).
-- Müşteri kendi `puanim` komutunu çağırınca service-role kendi telefonuyla
-- eşleşen satırı döndürür (router seviyesinde scope kontrolü).
-- ──────────────────────────────────────────────────────────────────────────

-- ── Sadakat üyeleri ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rst_loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  guest_phone TEXT NOT NULL,            -- E.164 normalize, "+31..." veya "+90..."
  guest_name TEXT,
  birthday TEXT,                        -- "MM-DD" — yıl tutmuyoruz, doğum günü hatırlatma için yeter
  email TEXT,
  notes TEXT,                           -- "vejetaryen", "fıstık alerjik"

  -- Otel pattern: lifetime istatistikler
  first_visit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ,
  visit_count INT NOT NULL DEFAULT 0,
  total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  favorite_items JSONB DEFAULT '[]'::jsonb,  -- top-3 menu_item adları

  -- Onay ve durum
  marketing_opt_in BOOLEAN NOT NULL DEFAULT TRUE,  -- WA mesaj kabulü
  source TEXT,                          -- "wa_self" | "qr_table" | "owner_added" | "import"
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rst_loyalty_tenant_phone UNIQUE (tenant_id, guest_phone)
);

CREATE INDEX IF NOT EXISTS idx_rst_loyalty_tenant_active
  ON rst_loyalty_members(tenant_id, last_visit_at DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_rst_loyalty_birthday
  ON rst_loyalty_members(tenant_id, birthday) WHERE is_active = TRUE AND birthday IS NOT NULL;

-- ── Sadakat ziyaret/etkinlik kaydı ──────────────────────────────────────
-- Sahip müşteriyle her etkileşimde tutmak isterse opsiyonel; bu MVP'de
-- ziyaret count'u rst_orders -> guest_phone eşleştirmesinden de türetilebilir,
-- ama burada explicit log faydalı (mesaj broadcast geçmişi vs.).
CREATE TABLE IF NOT EXISTS rst_loyalty_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES rst_loyalty_members(id) ON DELETE CASCADE,

  visit_type TEXT NOT NULL DEFAULT 'visit',  -- visit | birthday_msg | recall_msg | promo_msg
  spent NUMERIC(10,2),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rst_loyalty_visits_member
  ON rst_loyalty_visits(member_id, created_at DESC);

-- ── rst_orders ile bağlantı (opsiyonel guest_phone) ──────────────────────
-- Sipariş sırasında müşteri telefonu girilirse loyalty member otomatik
-- güncellenebilir (visit_count + total_spent). Trigger değil, app-side
-- yazılacak — önce sütun ekle.
ALTER TABLE rst_orders
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_member_id UUID REFERENCES rst_loyalty_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rst_orders_loyalty
  ON rst_orders(loyalty_member_id) WHERE loyalty_member_id IS NOT NULL;

-- ── rst_reservations ile bağlantı ────────────────────────────────────────
ALTER TABLE rst_reservations
  ADD COLUMN IF NOT EXISTS loyalty_member_id UUID REFERENCES rst_loyalty_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rst_reservations_loyalty
  ON rst_reservations(loyalty_member_id) WHERE loyalty_member_id IS NOT NULL;
