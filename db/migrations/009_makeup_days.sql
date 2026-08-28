CREATE TABLE IF NOT EXISTS makeup_days (
  held_on DATE PRIMARY KEY CHECK (held_on BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  schedule_day SMALLINT NOT NULL CHECK (schedule_day BETWEEN 1 AND 7),
  week_type TEXT NOT NULL CHECK (week_type IN ('numerator', 'denominator')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  updated_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_sessions_held_on_idx ON attendance_sessions(held_on);
-- statement-breakpoint
-- Окремий statement перед читанням/записом у Read Committed:
-- після очікування lock наступний statement бачить актуальний стан дати.
CREATE OR REPLACE FUNCTION lock_schedule_day(target_date DATE)
RETURNS VOID LANGUAGE SQL VOLATILE AS $$
  SELECT pg_advisory_xact_lock(
    hashtext(current_schema()), hashtext('vidmitka-calendar:' || target_date::TEXT)
  );
$$;
-- statement-breakpoint
-- Єдине визначення ефективного дня для розкладу, журналу й запису відміток.
-- Неактивний запис зберігає версію: видалення/повторне створення не оживляє стару форму.
CREATE OR REPLACE FUNCTION get_schedule_day(target_date DATE)
RETURNS TABLE (
  held_on DATE,
  calendar_day SMALLINT,
  schedule_day SMALLINT,
  week_type TEXT,
  is_makeup BOOLEAN,
  context_token TEXT
)
LANGUAGE SQL STABLE AS $$
  WITH resolved AS (
    SELECT EXTRACT(ISODOW FROM target_date)::SMALLINT AS calendar_day,
      CASE WHEN COALESCE(m.is_active, FALSE) THEN m.schedule_day
        ELSE EXTRACT(ISODOW FROM target_date)::SMALLINT END AS schedule_day,
      CASE WHEN COALESCE(m.is_active, FALSE) THEN m.week_type
        WHEN s.id IS NULL THEN NULL
        WHEN ((DATE_TRUNC('week', target_date::TIMESTAMP)::DATE
          - DATE_TRUNC('week', s.anchor_date::TIMESTAMP)::DATE) / 7) % 2 = 0
          THEN s.anchor_week_type
        WHEN s.anchor_week_type = 'numerator' THEN 'denominator'
        ELSE 'numerator' END AS week_type,
      COALESCE(m.is_active, FALSE) AS is_makeup,
      COALESCE(m.version, 0) AS version
    FROM (SELECT 1 AS id) singleton
    LEFT JOIN schedule_week_settings s ON s.id = singleton.id
    LEFT JOIN makeup_days m ON m.held_on = target_date
  )
  SELECT target_date, r.calendar_day, r.schedule_day, r.week_type, r.is_makeup,
    CONCAT(target_date::TEXT, ':', r.version, ':', r.schedule_day, ':', COALESCE(r.week_type, 'unset'))
  FROM resolved r;
$$;
