-- Otel hotels metadata column — wifi/breakfast/spa/persona vb. esnek alanlar
-- için. MVP1 demo seed bunu doldurur. MVP2 brand katmanı persona_prompt'u
-- buradan resolve edebilir.
ALTER TABLE otel_hotels
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
