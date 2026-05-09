-- ──────────────────────────────────────────────────────────────────────────
-- panel_qr_tokens — Desktop QR login tokens (2026-05-09)
--
-- Akış (WhatsApp Web pattern'i):
--   1) Desktop kullanıcısı qr.upudev.nl açar → server tek kullanımlık QR token
--      mint eder (status='pending', 60 sn TTL)
--   2) Tarayıcı /api/panel-session/qr-status?code=X polluyor (her 2sn)
--   3) Mobil panelde "🖥 Bilgisayardan Aç" → kamera → QR tara → mobil cookie
--      ile auth ederek POST /api/panel-session/qr-claim?code=X
--      → status='claimed', claimed_user_id + claimed_tenant set
--   4) Desktop polling: 'claimed' görür → /api/panel-session/qr-finish?code=X
--      → server-side cookie set (.upudev.nl scope) + status='finished'
--   5) Tarayıcı kullanıcının tenant subdomain'ine redirect olur
--
-- Tek kullanımlık + kısa TTL → çalıntı QR riski minimum.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS panel_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                           -- QR'da gözüken token
  status TEXT NOT NULL DEFAULT 'pending',              -- pending / claimed / finished / expired

  claimed_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_tenant TEXT,                                 -- emlak / bayi / market / otel / restoran / siteyonetim

  expires_at TIMESTAMPTZ NOT NULL,                     -- created_at + 60 sn
  claimed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_qr_status CHECK (status IN ('pending', 'claimed', 'finished', 'expired'))
);

-- Polling endpoint için status + code ile hızlı lookup
CREATE INDEX IF NOT EXISTS idx_qr_code_status
  ON panel_qr_tokens(code, status);

-- Eski expired token temizliği için (ayrı cleanup job çalıştırılabilir)
CREATE INDEX IF NOT EXISTS idx_qr_expires_at
  ON panel_qr_tokens(expires_at)
  WHERE status IN ('pending', 'claimed');
