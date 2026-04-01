-- ============================================================================
-- Agent Engine V2 — Migration SQL
-- Supabase SQL Editor'de çalıştırın. Idempotent — tekrar çalıştırılabilir.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. agent_tasks — görev yaşam döngüsü
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_tasks (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL,
  tenant_id       uuid NOT NULL,
  agent_key       text NOT NULL,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('cron','webhook','whatsapp','manual')),
  trigger_event   jsonb DEFAULT '{}'::jsonb,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','thinking','acting','waiting_human','done','failed')),
  current_step    int DEFAULT 0,
  max_steps       int DEFAULT 10,
  context         jsonb DEFAULT '{}'::jsonb,
  plan            jsonb DEFAULT '[]'::jsonb,
  execution_log   jsonb DEFAULT '[]'::jsonb,
  pending_proposal_id uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  error           text
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_active
  ON agent_tasks (status) WHERE status NOT IN ('done','failed');

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_agent
  ON agent_tasks (user_id, agent_key);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. agent_messages — ajan belleği (konuşma geçmişi)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  agent_key   text NOT NULL,
  task_id     uuid REFERENCES agent_tasks(id) ON DELETE SET NULL,
  role        text NOT NULL CHECK (role IN ('system','assistant','user','tool_result')),
  content     text NOT NULL,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_task
  ON agent_messages (task_id);

CREATE INDEX IF NOT EXISTS idx_agent_messages_user
  ON agent_messages (user_id, agent_key, created_at DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. agent_events — olay kuyruğu (DB trigger tetikleyiciler)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  user_id       uuid,
  event_type    text NOT NULL,
  source_table  text,
  source_id     text,
  payload       jsonb DEFAULT '{}'::jsonb,
  processed     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_unprocessed
  ON agent_events (processed, created_at) WHERE processed = false;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. RLS POLICIES — service_role bypass, anon erişim yok
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

-- agent_tasks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_tasks' AND policyname = 'agent_tasks_service_all') THEN
    CREATE POLICY agent_tasks_service_all ON agent_tasks
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_tasks' AND policyname = 'agent_tasks_deny_anon') THEN
    CREATE POLICY agent_tasks_deny_anon ON agent_tasks
      FOR ALL USING (auth.role() != 'anon');
  END IF;
END $$;

-- agent_messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_messages' AND policyname = 'agent_messages_service_all') THEN
    CREATE POLICY agent_messages_service_all ON agent_messages
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_messages' AND policyname = 'agent_messages_deny_anon') THEN
    CREATE POLICY agent_messages_deny_anon ON agent_messages
      FOR ALL USING (auth.role() != 'anon');
  END IF;
END $$;

-- agent_events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_events' AND policyname = 'agent_events_service_all') THEN
    CREATE POLICY agent_events_service_all ON agent_events
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_events' AND policyname = 'agent_events_deny_anon') THEN
    CREATE POLICY agent_events_deny_anon ON agent_events
      FOR ALL USING (auth.role() != 'anon');
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. updated_at TRIGGER — agent_tasks otomatik güncelleme
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER trg_agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 7. notify_agent_event() — DB değişikliklerini agent_events'e yazar
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_agent_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO agent_events (
    tenant_id,
    user_id,
    event_type,
    source_table,
    source_id,
    payload
  ) VALUES (
    COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'),
    NEW.user_id,
    TG_OP,
    TG_TABLE_NAME,
    NEW.id::text,
    row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. TRIGGERS — kaynak tablolara bağla
-- ────────────────────────────────────────────────────────────────────────────

-- reminders → sekreter
DROP TRIGGER IF EXISTS trg_reminders_agent ON reminders;
CREATE TRIGGER trg_reminders_agent
  AFTER INSERT ON reminders
  FOR EACH ROW EXECUTE FUNCTION notify_agent_event();

-- contracts → sekreter
DROP TRIGGER IF EXISTS trg_contracts_agent ON contracts;
CREATE TRIGGER trg_contracts_agent
  AFTER INSERT OR UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION notify_agent_event();

-- emlak_properties → portfoy
DROP TRIGGER IF EXISTS trg_properties_agent ON emlak_properties;
CREATE TRIGGER trg_properties_agent
  AFTER INSERT ON emlak_properties
  FOR EACH ROW EXECUTE FUNCTION notify_agent_event();

-- emlak_customers → satis
DROP TRIGGER IF EXISTS trg_customers_agent ON emlak_customers;
CREATE TRIGGER trg_customers_agent
  AFTER INSERT ON emlak_customers
  FOR EACH ROW EXECUTE FUNCTION notify_agent_event();


-- ────────────────────────────────────────────────────────────────────────────
-- 9. pg_cron — 2 dakikada bir agent-events işle
--    NOT: Supabase Hobby plan'da pg_cron desteklenmeyebilir.
--    Bu durumda Vercel Cron kullanılır (vercel.json'da tanımlı).
-- ────────────────────────────────────────────────────────────────────────────

-- pg_cron extension'ı aktifleştir (Supabase Pro plan gerekebilir)
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2 dakikada bir event processing endpoint'ini çağır
-- CRON_SECRET değerini Vercel env'den alın ve aşağıya yapıştırın:
--
-- SELECT cron.schedule(
--   'process-agent-events',
--   '*/2 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://estateai.upudev.nl/api/cron/agent-events',
--     headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
--   );
--   $$
-- );
--
-- Hobby plan alternatifi: vercel.json'da günlük cron tanımlıdır.
-- Pro plan'a geçildiğinde yukarıdaki satırları aktifleştirin.


-- ────────────────────────────────────────────────────────────────────────────
-- TAMAMLANDI
-- ────────────────────────────────────────────────────────────────────────────
