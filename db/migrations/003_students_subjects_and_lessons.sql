CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name),
  CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 200)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 100)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (full_name, group_name),
  CHECK (CHAR_LENGTH(full_name) BETWEEN 3 AND 200),
  CHECK (CHAR_LENGTH(group_name) BETWEEN 2 AND 100)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_user_id TEXT NOT NULL,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_user_id, subject_id)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS subject_students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_subject_id BIGINT NOT NULL REFERENCES teacher_subjects(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_subject_id, student_id)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS lessons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_subject_id BIGINT NOT NULL REFERENCES teacher_subjects(id) ON DELETE RESTRICT,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  class_period_id BIGINT NOT NULL REFERENCES class_periods(id) ON DELETE RESTRICT,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  week_type TEXT NOT NULL CHECK (
    week_type IN ('numerator', 'denominator', 'both')
  ),
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS semester_closures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  closed_by_user_id TEXT NOT NULL,
  deleted_lesson_count INTEGER NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
