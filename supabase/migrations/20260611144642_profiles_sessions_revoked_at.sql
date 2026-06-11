-- H-10 (2026-06-11 hardening audit): session revocation desteği.
--
-- JWT (HS256) stateless 30 gün; logout'ta server-side iptal yoktu — çalınan
-- token süresi dolana kadar geçerliydi. Bu kolon "tüm oturumları kapat"
-- damgası: bir kullanıcının sessions_revoked_at'inden ÖNCE üretilmiş tüm
-- token'lar geçersiz sayılır (auth guard'larda iat < sessions_revoked_at
-- kontrolü). Default NULL = hiçbir token etkilenmez (sıfır regresyon).
--
-- Additive + idempotent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMPTZ;
