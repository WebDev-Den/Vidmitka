CREATE TABLE IF NOT EXISTS schedule_week_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  anchor_date DATE NOT NULL,
  anchor_week_type TEXT NOT NULL CHECK (
    anchor_week_type IN ('numerator', 'denominator')
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
