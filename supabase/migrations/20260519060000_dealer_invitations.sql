-- Dealer invitations — controlled signup (panel flow), 2026-05-18.
--
-- B2B portal vizyonu: dağıtıcı panel'inden bayisini sisteme EKLER (telefon
-- + isim + mağaza). Bot bayiye davet mesajı gönderir, bayi kabul sayfasından
-- aktive eder.
--
-- Paralel sistem: bayi_invite_links (WA komutu /bayidavet ile çoklu kullanım
-- kodu) korunur. Bu tablo yeni "controlled" panel flow için.
--
-- Schema:
--   - tek kullanımlık (invite_code UNIQUE, accept sonra status='accepted')
--   - dağıtıcı önceden hedef bayi bilgilerini girer (name, store_name,
--     phone, store_address, tax_no, note)
--   - 7 gün TTL
--   - accepted_user_id: kabul edilince yaratılan bayi profile.id

BEGIN;

CREATE TABLE IF NOT EXISTS dealer_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  distributor_user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  store_name TEXT NOT NULL,
  store_address TEXT,
  tax_no TEXT,
  note TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | expired | cancelled
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealer_inv_distributor
  ON dealer_invitations (distributor_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dealer_inv_code
  ON dealer_invitations (invite_code);
CREATE INDEX IF NOT EXISTS idx_dealer_inv_phone
  ON dealer_invitations (phone);

COMMIT;

-- Rollback (manuel):
--   DROP TABLE IF EXISTS dealer_invitations;
