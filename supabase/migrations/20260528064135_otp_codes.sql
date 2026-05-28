-- OTP-first auth: login/signup/2fa/recovery için tek tablo.
--
-- Mevcut `step_up_challenges` tablosu profile_id NOT NULL FK olduğu için
-- signup'ta (henüz kullanıcı yokken) kullanılamıyordu. `otp_codes` phone
-- bazlı çalışır, user/profile var olmasa da kayıt tutar.
--
-- TTL: 5 dakika. Plain-text kod (step_up_challenges pattern'iyle tutarlı).
-- RLS: kapalı, sadece service role erişir.

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('login','signup','2fa','recovery')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  attempt_count int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Verify endpoint'i: phone + purpose için en güncel aktif kayıt
CREATE INDEX IF NOT EXISTS otp_codes_phone_purpose_active_idx
  ON public.otp_codes (phone, purpose, expires_at DESC)
  WHERE verified_at IS NULL;

-- Rate-limit endpoint'i: son N dakika içinde phone başına kaç request
CREATE INDEX IF NOT EXISTS otp_codes_phone_recent_idx
  ON public.otp_codes (phone, created_at DESC);

-- IP bazlı rate-limit (DoS koruması)
CREATE INDEX IF NOT EXISTS otp_codes_ip_recent_idx
  ON public.otp_codes (ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No policies → tamamen kapalı, sadece service role erişir.
