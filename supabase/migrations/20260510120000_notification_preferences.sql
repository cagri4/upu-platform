-- Bildirim tercihleri — kullanıcı başına bildirim türü × kanal toggle.
-- Hibrit tasarım: bu table relational/indexed (her tip ayrı row); sessiz saat
-- ve preset adı profiles.metadata.notifications JSON'ında tutulur.
--
-- 26 bildirim türü (7 Free + 19 Pro) merkezi katalog
-- src/platform/notifications/types.ts içinde tutulur.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  channel text NOT NULL DEFAULT 'wa',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
  ON public.notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_type_enabled
  ON public.notification_preferences(type, channel, enabled)
  WHERE enabled = true;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own" ON public.notification_preferences;
CREATE POLICY "users_read_own"
  ON public.notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON public.notification_preferences;
CREATE POLICY "users_update_own"
  ON public.notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own" ON public.notification_preferences;
CREATE POLICY "users_insert_own"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own" ON public.notification_preferences;
CREATE POLICY "users_delete_own"
  ON public.notification_preferences
  FOR DELETE
  USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at
  ON public.notification_preferences;

CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_notification_preferences_updated_at();
