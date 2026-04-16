-- Tips system: contextual product-usage hints sent during the day.
-- Replaces gamification quest/mission nudges with lighter discovery prompts.

CREATE TABLE IF NOT EXISTS user_tips_shown (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_key text NOT NULL DEFAULT 'emlak',
  tip_key text NOT NULL,
  shown_at timestamptz NOT NULL DEFAULT now(),
  clicked_at timestamptz,
  dismissed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_tips_user_shown ON user_tips_shown(user_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_tips_user_key ON user_tips_shown(user_id, tip_key);

CREATE TABLE IF NOT EXISTS user_notification_prefs (
  user_id uuid PRIMARY KEY,
  tips_enabled boolean NOT NULL DEFAULT true,
  tips_per_day integer NOT NULL DEFAULT 3,
  quiet_start_hour integer NOT NULL DEFAULT 22,
  quiet_end_hour integer NOT NULL DEFAULT 9,
  updated_at timestamptz NOT NULL DEFAULT now()
);
