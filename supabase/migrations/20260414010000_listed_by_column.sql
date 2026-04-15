-- Add listed_by column to emlak_properties
-- Values: 'sahibi' (property owner) or 'emlakci' (real estate agent)
ALTER TABLE emlak_properties ADD COLUMN IF NOT EXISTS listed_by text;
