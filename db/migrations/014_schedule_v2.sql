CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS academic_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL CHECK (CHAR_LENGTH(code) BETWEEN 1 AND 100 AND code = BTRIM(code)),
  code_normalized TEXT NOT NULL CHECK (CHAR_LENGTH(code_normalized) BETWEEN 1 AND 100),
  faculty TEXT,
  course SMALLINT CHECK (course IS NULL OR course BETWEEN 1 AND 12),
  study_form TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_normalized)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS disciplines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 300 AND name = BTRIM(name)),
  name_normalized TEXT NOT NULL CHECK (CHAR_LENGTH(name_normalized) BETWEEN 2 AND 300),
  short_name TEXT CHECK (short_name IS NULL OR CHAR_LENGTH(short_name) BETWEEN 1 AND 100),
  internal_code TEXT CHECK (internal_code IS NULL OR CHAR_LENGTH(internal_code) BETWEEN 1 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name_normalized)
);

-- statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS disciplines_internal_code_unique
ON disciplines (LOWER(internal_code)) WHERE internal_code IS NOT NULL;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_lesson_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 100 AND name = BTRIM(name)),
  name_normalized TEXT NOT NULL CHECK (CHAR_LENGTH(name_normalized) BETWEEN 2 AND 100),
  short_name TEXT CHECK (short_name IS NULL OR CHAR_LENGTH(short_name) BETWEEN 1 AND 40),
  color TEXT NOT NULL DEFAULT '#0F766E' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name_normalized)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 120 AND name = BTRIM(name)),
  name_normalized TEXT NOT NULL CHECK (CHAR_LENGTH(name_normalized) BETWEEN 1 AND 120),
  building TEXT,
  description TEXT,
  room_type TEXT,
  delivery_mode TEXT NOT NULL DEFAULT 'physical'
    CHECK (delivery_mode IN ('physical', 'remote', 'unspecified')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name_normalized)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL
    CHECK (CHAR_LENGTH(display_name) BETWEEN 2 AND 200 AND display_name = BTRIM(display_name)),
  display_name_normalized TEXT NOT NULL CHECK (CHAR_LENGTH(display_name_normalized) BETWEEN 2 AND 200),
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  short_name TEXT,
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (display_name_normalized)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id UUID NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
  lesson_type_id UUID NOT NULL REFERENCES schedule_lesson_types(id) ON DELETE RESTRICT,
  class_period_id BIGINT NOT NULL REFERENCES class_periods(id) ON DELETE RESTRICT,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  week_pattern TEXT NOT NULL CHECK (week_pattern IN ('numerator', 'denominator', 'both')),
  valid_from DATE,
  valid_until DATE,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_kind TEXT,
  source_id TEXT,
  source_payload_hash TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  updated_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

-- statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS schedule_entries_source_unique
ON schedule_entries (source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_entries_lookup_idx
ON schedule_entries (day_of_week, week_pattern, valid_from, valid_until, class_period_id)
WHERE is_active;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_entry_groups (
  entry_id UUID NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES academic_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (entry_id, group_id)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_entry_groups_group_idx
ON schedule_entry_groups (group_id, entry_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_entry_teachers (
  entry_id UUID NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  PRIMARY KEY (entry_id, teacher_id)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_entry_teachers_teacher_idx
ON schedule_entry_teachers (teacher_id, entry_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_entry_rooms (
  entry_id UUID NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES schedule_rooms(id) ON DELETE RESTRICT,
  PRIMARY KEY (entry_id, room_id)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_entry_rooms_room_idx
ON schedule_entry_rooms (room_id, entry_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_entry_id UUID REFERENCES schedule_entries(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN (
    'move', 'reschedule', 'room_change', 'teacher_change',
    'discipline_change', 'type_change', 'cancel', 'one_time'
  )),
  original_date DATE NOT NULL,
  new_date DATE,
  class_period_id BIGINT REFERENCES class_periods(id) ON DELETE RESTRICT,
  custom_start_time TIME,
  custom_end_time TIME,
  discipline_id UUID REFERENCES disciplines(id) ON DELETE RESTRICT,
  lesson_type_id UUID REFERENCES schedule_lesson_types(id) ON DELETE RESTRICT,
  source_schedule_day SMALLINT CHECK (source_schedule_day IS NULL OR source_schedule_day BETWEEN 1 AND 7),
  source_schedule_week TEXT CHECK (
    source_schedule_week IS NULL OR source_schedule_week IN ('numerator', 'denominator')
  ),
  reason TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'cancelled')),
  source_kind TEXT,
  source_id TEXT,
  source_payload_hash TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  updated_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (custom_end_time IS NULL OR custom_start_time IS NULL OR custom_end_time > custom_start_time),
  CHECK (base_entry_id IS NOT NULL OR kind = 'one_time'),
  CHECK (
    kind <> 'one_time'
    OR (discipline_id IS NOT NULL AND lesson_type_id IS NOT NULL AND class_period_id IS NOT NULL)
  )
);

-- statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS schedule_exceptions_source_unique
ON schedule_exceptions (source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_exceptions_original_date_idx
ON schedule_exceptions (original_date, status);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_exceptions_new_date_idx
ON schedule_exceptions (new_date, status) WHERE new_date IS NOT NULL;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_exceptions_base_entry_idx
ON schedule_exceptions (base_entry_id, original_date) WHERE base_entry_id IS NOT NULL;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_exception_groups (
  exception_id UUID NOT NULL REFERENCES schedule_exceptions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES academic_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (exception_id, group_id)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_exception_groups_group_idx
ON schedule_exception_groups (group_id, exception_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_exception_teachers (
  exception_id UUID NOT NULL REFERENCES schedule_exceptions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  PRIMARY KEY (exception_id, teacher_id)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_exception_teachers_teacher_idx
ON schedule_exception_teachers (teacher_id, exception_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_exception_rooms (
  exception_id UUID NOT NULL REFERENCES schedule_exceptions(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES schedule_rooms(id) ON DELETE RESTRICT,
  PRIMARY KEY (exception_id, room_id)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_exception_rooms_room_idx
ON schedule_exception_rooms (room_id, exception_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL CHECK (file_hash ~ '^[a-f0-9]{64}$'),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 5242880),
  status TEXT NOT NULL CHECK (status IN ('previewed', 'committed', 'failed')),
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  created_count INTEGER NOT NULL DEFAULT 0 CHECK (created_count >= 0),
  updated_count INTEGER NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  created_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_import_runs_file_hash_idx
ON schedule_import_runs (file_hash, created_at DESC);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS schedule_import_items (
  run_id UUID NOT NULL REFERENCES schedule_import_runs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  source_id TEXT NOT NULL CHECK (source_id ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('created', 'updated', 'skipped', 'error')),
  message TEXT,
  exception_id UUID REFERENCES schedule_exceptions(id) ON DELETE SET NULL,
  sanitized_payload JSONB NOT NULL,
  PRIMARY KEY (run_id, row_number)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS schedule_import_items_source_idx
ON schedule_import_items (source_id, run_id);

-- statement-breakpoint

ALTER TABLE schedule_week_settings
ADD COLUMN IF NOT EXISTS semester_start DATE;

-- statement-breakpoint

ALTER TABLE schedule_week_settings
ADD COLUMN IF NOT EXISTS semester_end DATE;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS admin_login_throttle (
  key_hash TEXT PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts SMALLINT NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 1000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS admin_login_throttle_updated_idx
ON admin_login_throttle (updated_at);

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_week_settings_semester_range_check'
  ) THEN
    ALTER TABLE schedule_week_settings
    ADD CONSTRAINT schedule_week_settings_semester_range_check
    CHECK (semester_end IS NULL OR semester_start IS NULL OR semester_end >= semester_start);
  END IF;
END
$$;
