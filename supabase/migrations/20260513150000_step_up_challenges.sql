-- Faz 6.6 — WA OTP step-up challenge table
-- Hassas işlemler için (Google unlink, üyelik iptal) ikinci doğrulama:
-- 6 haneli kod WA'ya gönderilir, kullanıcı kod girer, verify cookie ile
-- 10 dk geçerli. Bu tablo verify edilmemiş aktif challenge'ları tutar.

CREATE TABLE IF NOT EXISTS public.step_up_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profile için aktif challenge lookup hızlı olsun (verify endpoint'i için)
CREATE INDEX IF NOT EXISTS step_up_challenges_profile_active_idx
  ON public.step_up_challenges (profile_id, expires_at)
  WHERE verified_at IS NULL;

-- Rate-limit için son 1 saat sorgusu (created_at-based)
CREATE INDEX IF NOT EXISTS step_up_challenges_profile_recent_idx
  ON public.step_up_challenges (profile_id, created_at DESC);
