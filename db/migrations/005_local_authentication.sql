CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('administrator', 'teacher')),
  approval_status TEXT NOT NULL CHECK (approval_status IN ('approved', 'pending')),
  approved_at TIMESTAMPTZ,
  approved_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  failed_login_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (CHAR_LENGTH(email) BETWEEN 3 AND 320),
  CHECK (CHAR_LENGTH(full_name) BETWEEN 3 AND 200)
);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
ON auth_sessions (user_id);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
ON auth_sessions (expires_at);

-- statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teacher_subjects' AND column_name = 'teacher_clerk_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teacher_subjects' AND column_name = 'teacher_user_id'
  ) THEN
    ALTER TABLE teacher_subjects
    RENAME COLUMN teacher_clerk_id TO teacher_user_id;
  END IF;
END
$$;

-- statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'teacher_clerk_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'teacher_user_id'
  ) THEN
    ALTER TABLE lessons
    RENAME COLUMN teacher_clerk_id TO teacher_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'created_by_clerk_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE lessons
    RENAME COLUMN created_by_clerk_id TO created_by_user_id;
  END IF;
END
$$;

-- statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'semester_closures' AND column_name = 'closed_by_clerk_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'semester_closures' AND column_name = 'closed_by_user_id'
  ) THEN
    ALTER TABLE semester_closures
    RENAME COLUMN closed_by_clerk_id TO closed_by_user_id;
  END IF;
END
$$;

-- statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teacher_subjects_teacher_clerk_id_subject_id_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teacher_subjects_teacher_user_id_subject_id_key'
  ) THEN
    ALTER TABLE teacher_subjects
    RENAME CONSTRAINT teacher_subjects_teacher_clerk_id_subject_id_key
    TO teacher_subjects_teacher_user_id_subject_id_key;
  END IF;
END
$$;

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teacher_subjects_teacher_user_id_fkey'
  ) THEN
    ALTER TABLE teacher_subjects
    ADD CONSTRAINT teacher_subjects_teacher_user_id_fkey
    FOREIGN KEY (teacher_user_id) REFERENCES app_users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lessons_teacher_user_id_fkey'
  ) THEN
    ALTER TABLE lessons
    ADD CONSTRAINT lessons_teacher_user_id_fkey
    FOREIGN KEY (teacher_user_id) REFERENCES app_users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lessons_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE lessons
    ADD CONSTRAINT lessons_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES app_users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_closures_closed_by_user_id_fkey'
  ) THEN
    ALTER TABLE semester_closures
    ADD CONSTRAINT semester_closures_closed_by_user_id_fkey
    FOREIGN KEY (closed_by_user_id) REFERENCES app_users(id) ON DELETE RESTRICT;
  END IF;
END
$$;
