-- Otel rezervasyonları için notes + guest_email alanları (Faz 2 follow-up)
-- Public booking talebinde misafirin notu + email saklanır.

ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS guest_email TEXT;
