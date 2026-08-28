ALTER TABLE lesson_types ADD COLUMN IF NOT EXISTS color TEXT;
-- statement-breakpoint
-- Backfill only missing colors: reapplying must preserve administrator choices.
UPDATE lesson_types SET color = CASE LOWER(name)
  WHEN 'практична' THEN '#16835B'
  WHEN 'лабораторна' THEN '#073C40'
  ELSE '#0F766E' END
WHERE color IS NULL;
-- statement-breakpoint
ALTER TABLE lesson_types
  ALTER COLUMN color SET DEFAULT '#0F766E',
  ALTER COLUMN color SET NOT NULL,
  DROP CONSTRAINT IF EXISTS lesson_types_color_allowed,
  ADD CONSTRAINT lesson_types_color_allowed CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
