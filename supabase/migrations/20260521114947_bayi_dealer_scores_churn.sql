-- Faz A — Bayi performans skoru + churn risk altyapısı.
--
-- 3.1 Performans Skoru:
--   bayi_dealer_scores tablosu = haftalık snapshot per dealer.
--   4 alt-skor (volume, regularity, collection, trend) — 0-100, ortalama = total.
--
-- 3.2 Churn Risk:
--   bayi_churn_signals view = runtime hesaplı, son sipariş + vade + trend
--   eşik koşullarıyla 3 seviye (ok / watch / risk).
--   View tablo değil — istek anında güncel; analiz cron'u extra log gerekmez.
--
-- Migration kuralı (CLAUDE.md): IF NOT EXISTS, additive, no DROP.

CREATE TABLE IF NOT EXISTS public.bayi_dealer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL,
  period_start DATE NOT NULL,          -- ISO-week başlangıcı (Pazartesi)
  period_end DATE NOT NULL,            -- period_start + 7 gün
  score_total NUMERIC(5,2) NOT NULL,   -- 0-100 ortalama
  sub_volume NUMERIC(5,2) NOT NULL,    -- son 90 gün sipariş hacmi (peer-normalized)
  sub_regularity NUMERIC(5,2) NOT NULL,-- sipariş aralık varyans (düşük = yüksek skor)
  sub_collection NUMERIC(5,2) NOT NULL,-- vade uyumu (geç tahsilat = düşük)
  sub_trend NUMERIC(5,2) NOT NULL,     -- son 30g vs önceki 30g büyüme
  signals JSONB DEFAULT '{}'::jsonb,   -- debug: hesap girdileri
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dealer_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_dealer_scores_tenant_period
  ON public.bayi_dealer_scores(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_scores_dealer
  ON public.bayi_dealer_scores(dealer_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_scores_total
  ON public.bayi_dealer_scores(tenant_id, score_total DESC, period_start DESC);

-- Churn signals view — runtime
-- Son sipariş tarihi, vade gecikme günleri, sipariş frekansı düşüş trendi.
CREATE OR REPLACE VIEW public.bayi_churn_signals AS
WITH last_orders AS (
  SELECT
    o.dealer_id,
    o.tenant_id,
    MAX(o.created_at) AS last_order_at,
    COUNT(*) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days') AS orders_last_30d,
    COUNT(*) FILTER (WHERE o.created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days') AS orders_prev_30d,
    COUNT(*) FILTER (WHERE o.created_at > NOW() - INTERVAL '90 days') AS orders_last_90d
  FROM public.bayi_orders o
  GROUP BY o.dealer_id, o.tenant_id
),
overdue AS (
  SELECT
    t.dealer_id,
    MAX(GREATEST(0, EXTRACT(DAY FROM (NOW() - t.due_date::timestamptz))::int)) AS max_overdue_days
  FROM public.bayi_dealer_transactions t
  WHERE t.due_date IS NOT NULL AND t.due_date < NOW()
  GROUP BY t.dealer_id
)
SELECT
  d.id AS dealer_id,
  d.tenant_id,
  d.name AS dealer_name,
  d.company_name,
  COALESCE(d.balance, 0)::numeric AS balance,
  lo.last_order_at,
  EXTRACT(DAY FROM (NOW() - COALESCE(lo.last_order_at, d.created_at)))::int AS days_since_last_order,
  COALESCE(lo.orders_last_30d, 0) AS orders_last_30d,
  COALESCE(lo.orders_prev_30d, 0) AS orders_prev_30d,
  COALESCE(lo.orders_last_90d, 0) AS orders_last_90d,
  COALESCE(ov.max_overdue_days, 0) AS max_overdue_days,
  CASE
    WHEN COALESCE(ov.max_overdue_days, 0) >= 30
      OR EXTRACT(DAY FROM (NOW() - COALESCE(lo.last_order_at, d.created_at)))::int >= 60 THEN 'risk'
    WHEN COALESCE(ov.max_overdue_days, 0) >= 7
      OR EXTRACT(DAY FROM (NOW() - COALESCE(lo.last_order_at, d.created_at)))::int >= 30
      OR (COALESCE(lo.orders_prev_30d, 0) > 0 AND COALESCE(lo.orders_last_30d, 0) < COALESCE(lo.orders_prev_30d, 0) / 2.0) THEN 'watch'
    ELSE 'ok'
  END AS risk_level
FROM public.bayi_dealers d
LEFT JOIN last_orders lo ON lo.dealer_id = d.id
LEFT JOIN overdue ov ON ov.dealer_id = d.id
WHERE d.is_active IS NOT FALSE;

ALTER TABLE public.bayi_dealer_scores ENABLE ROW LEVEL SECURITY;
-- INSERT/UPDATE sadece service role (cron + helper).
