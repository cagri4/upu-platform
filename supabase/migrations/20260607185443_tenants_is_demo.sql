-- 20260607185443_tenants_is_demo.sql
--
-- MİMARİ HEDEF: DEMO tenant kavramı yarı DB yarı config ile temsil
-- ediliyordu. src/tenants/config.ts'deki 7 sabit UUID kodda; runtime'da
-- her stats/admin sorgusu config import edip `demoSet.has(tenant.id)`
-- karşılaştırması yapıyordu. İki kaynaktan truth anti-pattern.
--
-- ÇÖZÜM: tenants.is_demo BOOLEAN ekle, 7 sabit UUID için true.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tenants_is_demo
  ON public.tenants(is_demo)
  WHERE is_demo = true;

-- Backfill — config.ts'deki 7 DEMO UUID
UPDATE public.tenants SET is_demo = true
WHERE id IN (
  '3f3598fc-a93e-4c73-bd33-7c4217f6c089'::uuid,  -- emlak
  '32f5feda-700f-44c6-a270-5bbb5a040994'::uuid,  -- bayi
  'c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e'::uuid,  -- market
  '16871326-afef-4ba3-a079-2c5ede8fac4d'::uuid,  -- otel
  '03f58dcb-b931-4dcf-bd47-a0885f9286e8'::uuid,  -- restoran
  'af1f27b0-2ec1-4423-9b93-2aa29979b73a'::uuid,  -- siteyonetim
  '31a22a5a-cf38-48b5-914d-a67bde4c1e16'::uuid   -- muhasebe
);

-- Doğrulama
DO $$
DECLARE
  demo_count INTEGER;
BEGIN
  SELECT count(*) INTO demo_count FROM public.tenants WHERE is_demo = true;
  IF demo_count <> 7 THEN
    RAISE WARNING '[tenants.is_demo] backfill MISMATCH: % demo tenant (beklenen 7)', demo_count;
  ELSE
    RAISE NOTICE '[tenants.is_demo] backfill OK: 7 DEMO tenant';
  END IF;
END $$;
