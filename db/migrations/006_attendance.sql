ALTER TABLE subject_students
  ADD COLUMN IF NOT EXISTS subgroup TEXT NOT NULL DEFAULT ''
  CHECK (LENGTH(subgroup) <= 100);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL,
  teacher_subject_id BIGINT NOT NULL REFERENCES teacher_subjects(id) ON DELETE RESTRICT,
  teacher_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  held_on DATE NOT NULL,
  subject_name TEXT NOT NULL,
  room_name TEXT NOT NULL,
  period_number SMALLINT NOT NULL,
  start_minute SMALLINT NOT NULL,
  end_minute SMALLINT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, held_on)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_sessions_teacher_date_idx
  ON attendance_sessions(teacher_user_id, held_on);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS attendance_entries (
  session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  subgroup TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('unmarked', 'present', 'absent', 'not_required')),
  PRIMARY KEY (session_id, student_id)
);
