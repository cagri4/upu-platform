-- İter 2 İş #4 — Rol sistemi + dağıtıcı şirketi içi kullanıcı davet akışı
--
-- user_invitations: admin'in şirketine eklediği iç kullanıcılar (muhasebe,
-- depocu, satış) için davet kayıtları. Çalışan/kullanıcı bayinin DIŞ
-- kullanıcısı değil — dağıtıcının kendi şirketindeki yetkili.
--
-- Akış (WA-first paylaş pattern):
--   1. Admin form doldurur (ad, telefon, rol)
--   2. Backend invite_token üretir, user_invitations row insert
--   3. Modal Kopyala/WA/SMS 3 paylaş buton — admin link'i kendi WA'sından
--      gönderir (otomatik mesaj YOK, WA 24-saat customer service window
--      ihlal etmesin)
--   4. Çalışan link tıklar → /tr/kullanici-davet/<token> → telefon + cookie
--      session attach + tenant role'lu profile
--
-- Mevcut dealer_invitations korunur (dış bayi davet). Bu ayrı tablo iç
-- kullanıcılar için.

CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL,
  invitee_phone TEXT NOT NULL,
  invitee_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'muhasebe', 'depocu', 'satis')),
  invite_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_user_inv_token ON user_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_user_inv_tenant_phone ON user_invitations(tenant_id, invitee_phone);
CREATE INDEX IF NOT EXISTS idx_user_inv_status ON user_invitations(tenant_id, status);
