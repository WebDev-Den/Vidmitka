CREATE TABLE IF NOT EXISTS class_periods (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number SMALLINT NOT NULL UNIQUE CHECK (number BETWEEN 1 AND 99),
  start_minute SMALLINT NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute SMALLINT NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_minute < end_minute)
);

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'class_periods_no_active_time_overlap'
  ) THEN
    ALTER TABLE class_periods
      ADD CONSTRAINT class_periods_no_active_time_overlap
      EXCLUDE USING GIST (
        int4range(start_minute::INTEGER, end_minute::INTEGER, '[)') WITH &&
      )
      WHERE (is_active);
  END IF;
END
$$;

-- statement-breakpoint

INSERT INTO class_periods (number, start_minute, end_minute)
VALUES
  (1, 480, 560),
  (2, 575, 655),
  (3, 670, 750),
  (4, 780, 860),
  (5, 875, 955),
  (6, 970, 1050),
  (7, 1065, 1145),
  (8, 1150, 1230)
ON CONFLICT (number) DO NOTHING;
