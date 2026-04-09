-- Convert numeric emlak_properties columns to TEXT so they can store
-- sahibinden-compatible labels like "5-10", "21+", "0 (Yeni)", "4+",
-- "Bodrum Kat" — values that don't fit a single integer.
--
-- Existing integer values are preserved by casting to text.

ALTER TABLE emlak_properties
  ALTER COLUMN floor TYPE text USING floor::text;

ALTER TABLE emlak_properties
  ALTER COLUMN building_age TYPE text USING building_age::text;

ALTER TABLE emlak_properties
  ALTER COLUMN total_floors TYPE text USING total_floors::text;

ALTER TABLE emlak_properties
  ALTER COLUMN bathroom_count TYPE text USING bathroom_count::text;
