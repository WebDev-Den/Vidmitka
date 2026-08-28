ALTER TABLE class_periods ADD COLUMN IF NOT EXISTS color TEXT;
-- statement-breakpoint
-- Backfill only unset colors; rerunning never replaces an administrator's choice.
UPDATE class_periods SET color = CASE MOD(number - 1, 8)
  WHEN 0 THEN '#0F766E'
  WHEN 1 THEN '#48C5B5'
  WHEN 2 THEN '#16835B'
  WHEN 3 THEN '#DED9CD'
  WHEN 4 THEN '#073C40'
  WHEN 5 THEN '#EFECE6'
  WHEN 6 THEN '#243B3A'
  ELSE '#18283D'
END WHERE color IS NULL;
-- statement-breakpoint
ALTER TABLE class_periods
  ALTER COLUMN color SET DEFAULT '#0F766E',
  ALTER COLUMN color SET NOT NULL;
-- statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'class_periods'::regclass AND conname = 'class_periods_color_allowed'
  ) THEN
    ALTER TABLE class_periods ADD CONSTRAINT class_periods_color_allowed CHECK (
      color IN ('#0F766E', '#48C5B5', '#16835B', '#DED9CD', '#073C40', '#EFECE6', '#243B3A', '#18283D')
    );
  END IF;
END;
$$;
