-- Müşteri kartlarına silme aksiyonu — soft-delete pattern.
-- deleted_at NULL ise aktif, NOT NULL ise silinmiş.
-- Listeleme/eşleştirme akışları .is("deleted_at", null) filter'ı kullanmalı.

ALTER TABLE emlak_customers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_emlak_customers_deleted_at
  ON emlak_customers (user_id) WHERE deleted_at IS NULL;
