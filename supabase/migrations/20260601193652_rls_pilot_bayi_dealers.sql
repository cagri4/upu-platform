-- RLS pilot: bayi_dealers (2026-06-01)
--
-- Multi-tenant DB enforcement — Adım A pilot. Frontend doğrudan DB okumuyor
-- (her şey /api/* üzerinden service-role ile gidiyor) ama defense-in-depth:
-- anon-key sızıntısında veya gelecekteki client-side query'lerde DB'nin
-- kendisi tenant izolasyonunu zorlar.
--
-- Pattern (sy_buildings vb. ile aynı — sanat-galeri RLS Faz 47 referans):
--   tenant_id IN (SELECT tenant_id FROM profiles WHERE auth_user_id = auth.uid())
--
-- Service role otomatik bypass eder; backend endpoint'ler etkilenmez.
--
-- Adım B'ye geçmeden önce 5-katman test (anon SELECT → 0, panel regression,
-- bot regression). Test geçerse Çağrı onayıyla kalan 79 tabloya yayılır.

BEGIN;

ALTER TABLE public.bayi_dealers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealers;

CREATE POLICY "tenant_isolation" ON public.bayi_dealers
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
       WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
       WHERE auth_user_id = auth.uid()
    )
  );

COMMIT;

-- ──────────────────────────────────────────────────────────────────────
-- ROLLBACK PLAN (regression halinde elde hazır):
--   BEGIN;
--   DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealers;
--   ALTER TABLE public.bayi_dealers DISABLE ROW LEVEL SECURITY;
--   COMMIT;
-- ──────────────────────────────────────────────────────────────────────
