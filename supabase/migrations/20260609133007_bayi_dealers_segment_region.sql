-- Dağıtıcı bayi yönetimi — segment + region kolonları (2026-06-09)
--
-- Faz 1.1 (B2B Portal MVP): bayi listesinde segment (A/B/C) ve region
-- filtreleme yapılacak. Mevcut bayi_dealers tablosuna additive ekleniyor;
-- legacy satırlar segment=NULL kalır, UI'da "Atanmamış" gösterir.

BEGIN;

ALTER TABLE public.bayi_dealers
  ADD COLUMN IF NOT EXISTS segment TEXT
    CHECK (segment IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS region TEXT;

CREATE INDEX IF NOT EXISTS idx_bayi_dealers_segment
  ON public.bayi_dealers (tenant_id, segment);

CREATE INDEX IF NOT EXISTS idx_bayi_dealers_region
  ON public.bayi_dealers (tenant_id, region);

COMMIT;
