-- Test state snapshots — save/load mechanism for dev workflow.
-- Used by the /kaydet and /yukle admin commands so we don't have to
-- rebuild a test user from scratch every time a bug is found + fixed.
CREATE TABLE IF NOT EXISTS user_test_snapshots (
  user_id uuid PRIMARY KEY,
  tenant_key text,
  data jsonb NOT NULL,
  saved_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uts_user ON user_test_snapshots(user_id);
