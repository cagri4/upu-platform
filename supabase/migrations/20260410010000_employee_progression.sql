-- Meta-Progression: employee career system + XP economy + seasonal events.
-- See .planning/meta-progression-plan.md for full design doc.

-- ── Per-employee tier + XP ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_employee_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_key text NOT NULL,      -- portfoy / satis / analist / sekreter / medya
  tier integer NOT NULL DEFAULT 1,  -- 1=Stajyer, 2=Junior, 3=Senior, 4=Expert, 5=Master
  xp integer NOT NULL DEFAULT 0,
  total_xp_earned integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, employee_key)
);

CREATE INDEX IF NOT EXISTS idx_uep_user ON user_employee_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_uep_employee ON user_employee_progress(employee_key);

-- ── XP event log (audit + analytics) ────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_key text NOT NULL,
  amount integer NOT NULL,
  source text NOT NULL,            -- daily_task / mission / streak / combo / seasonal_bonus
  source_ref text,                 -- task_id or mission_key
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xpe_user ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xpe_created ON xp_events(created_at);

-- ── Seasonal events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasonal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  tenant_key text,                 -- null = all tenants
  bonus_xp_multiplier numeric NOT NULL DEFAULT 1.5,
  employee_focus text[],           -- which employees get bonus
  active boolean NOT NULL DEFAULT true
);

-- ── Extend existing tables ──────────────────────────────────────────
-- Each mission belongs to an employee and awards XP.
ALTER TABLE platform_missions
  ADD COLUMN IF NOT EXISTS employee_key text,
  ADD COLUMN IF NOT EXISTS xp_reward integer DEFAULT 20;

-- Each daily task belongs to an employee and awards XP.
ALTER TABLE user_daily_tasks
  ADD COLUMN IF NOT EXISTS employee_key text,
  ADD COLUMN IF NOT EXISTS xp_reward integer DEFAULT 5;

-- ── Seed seasonal events (real estate calendar) ─────────────────────
INSERT INTO seasonal_events (key, title, description, start_date, end_date, tenant_key, bonus_xp_multiplier, employee_focus)
VALUES
  ('bahar_tazeleme', '🌸 Bahar Tazeleme', 'Fotoğraf güncelleme ve portföy yenileme dönemi', '2026-03-01', '2026-04-30', 'emlak', 1.5, ARRAY['portfoy']),
  ('yazlik_sezonu', '🏖 Yazlık Sezonu', 'Bodrum/Çeşme/Alaçatı yazlık odaklı portföy ve medya', '2026-06-01', '2026-08-31', 'emlak', 1.5, ARRAY['portfoy', 'medya']),
  ('ogrenci_evi', '🎓 Öğrenci Evi Sezonu', 'Stüdyo ve 1+1 kiralık odaklı satış dönemi', '2026-09-01', '2026-09-30', 'emlak', 1.5, ARRAY['satis']),
  ('yilbasi_ivme', '🎊 Yılbaşı Satış İvmesi', 'İndirimli ilan kampanyaları ve medya odağı', '2027-01-01', '2027-01-31', 'emlak', 1.5, ARRAY['medya'])
ON CONFLICT (key) DO NOTHING;

-- ── Update existing emlak missions with employee_key ────────────────
UPDATE platform_missions SET employee_key = 'portfoy', xp_reward = 20 WHERE mission_key = 'emlak_ilk_mulk';
UPDATE platform_missions SET employee_key = 'portfoy', xp_reward = 15 WHERE mission_key = 'emlak_mulk_bilgi_tamamla';
UPDATE platform_missions SET employee_key = 'portfoy', xp_reward = 15 WHERE mission_key = 'emlak_mulk_foto';
UPDATE platform_missions SET employee_key = 'analist', xp_reward = 10 WHERE mission_key = 'emlak_fiyat_kontrol';
UPDATE platform_missions SET employee_key = 'satis', xp_reward = 20 WHERE mission_key = 'emlak_ilk_musteri';
UPDATE platform_missions SET employee_key = 'satis', xp_reward = 20 WHERE mission_key = 'emlak_ilk_eslestirme';
UPDATE platform_missions SET employee_key = 'satis', xp_reward = 25 WHERE mission_key = 'emlak_ilk_sunum';
UPDATE platform_missions SET employee_key = 'satis', xp_reward = 15 WHERE mission_key = 'emlak_ilk_takip';
UPDATE platform_missions SET employee_key = 'analist', xp_reward = 15 WHERE mission_key = 'emlak_ilk_analiz';
UPDATE platform_missions SET employee_key = 'sekreter', xp_reward = 10 WHERE mission_key = 'emlak_ilk_brifing';
UPDATE platform_missions SET employee_key = 'medya', xp_reward = 10 WHERE mission_key = 'emlak_ilk_paylas';
