-- Faz 6.1 — Google OAuth bridge
-- profiles tablosuna Google OAuth alanları ekle.
-- google_sub: Google'ın unique kullanıcı ID'si (en kararlı tekil tanımlayıcı)
-- google_email: Kullanıcının Google email'i (gösterim + tanı için)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS google_sub text;

-- Bir Google hesabı sadece bir profile'a bağlanabilir.
-- google_sub NULL ise unique kısıtı uygulanmaz (kısmi index).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_google_sub_unique
  ON public.profiles (google_sub)
  WHERE google_sub IS NOT NULL;

-- Email ile lookup hızlı olsun (callback'te email match için).
CREATE INDEX IF NOT EXISTS profiles_google_email_idx
  ON public.profiles (lower(google_email))
  WHERE google_email IS NOT NULL;
