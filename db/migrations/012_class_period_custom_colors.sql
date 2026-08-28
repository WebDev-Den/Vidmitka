-- Replace only the palette check; preserve all colors, defaults, times and lesson data.
-- One ALTER statement keeps the replacement atomic and makes reapplication safe.
ALTER TABLE class_periods
  DROP CONSTRAINT IF EXISTS class_periods_color_allowed,
  ADD CONSTRAINT class_periods_color_allowed
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
