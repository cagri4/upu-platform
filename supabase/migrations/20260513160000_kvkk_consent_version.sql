-- Faz 7.0 — KVKK consent version tracking
-- profiles tablosuna kvkk_consent_version kolonu (text). Aydınlatma metni
-- her güncellendiğinde versiyon değişir; kullanıcının onayladığı sürüm bu
-- alanda tutulur. needsConsent kararı: kvkk_consent_at NULL VEYA
-- kvkk_consent_version !== "v1" (geçerli sürüm).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kvkk_consent_version text;

-- Daha önce onay vermiş kullanıcılar için "legacy" işaretle — v1 modal'ı
-- yine gösterilir ki güncel sürümü onaylayabilsinler.
UPDATE public.profiles
SET kvkk_consent_version = 'legacy'
WHERE kvkk_consent_at IS NOT NULL AND kvkk_consent_version IS NULL;
