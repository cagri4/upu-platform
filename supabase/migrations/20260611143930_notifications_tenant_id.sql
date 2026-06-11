-- H-09 (2026-06-11 hardening audit): notifications tablosuna tenant_id ekle.
--
-- Mevcut durumda notifications yalnız user_id ile filtreleniyordu. user_id =
-- profiles.id (tenant-unique) olduğu için fiilî cross-tenant sızıntı YOK, ama
-- mimari netlik + defense-in-depth için explicit tenant_id kolonu eklenir.
--
-- Additive + idempotent: kolon eklenir, mevcut satırlar profiles üzerinden
-- backfill edilir, (tenant_id, user_id) index'lenir. FK YOK (notifications
-- platform-geneli; tenant silinse de bildirim geçmişi ON DELETE riskine
-- girmesin — yumuşak referans).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Backfill: her bildirimin sahibinin tenant'ı
UPDATE public.notifications n
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE n.user_id = p.id
  AND n.tenant_id IS NULL;

-- Sorgu hızlandırma (tenant + kullanıcı filtreli okuma)
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user
  ON public.notifications (tenant_id, user_id);
