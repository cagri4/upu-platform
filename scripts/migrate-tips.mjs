import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = readFileSync("/home/cagr/Masaüstü/upu-platform/.env.local","utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

// Try to create tables via RPC
const ddl = `
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
`;

const { error } = await sb.rpc("exec_sql", { sql: ddl });
if (error) {
  console.log("⚠️  Could not create via rpc:", error.message);
  console.log("\nRun this SQL manually in Supabase Studio:\n\n" + ddl);
} else {
  console.log("✓ Tables created");
}
