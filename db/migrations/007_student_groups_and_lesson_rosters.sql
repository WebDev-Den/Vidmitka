CREATE TABLE IF NOT EXISTS student_groups (
  name TEXT PRIMARY KEY CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- statement-breakpoint
INSERT INTO student_groups (name)
SELECT DISTINCT group_name FROM students
ON CONFLICT (name) DO NOTHING;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION ensure_student_group() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO student_groups (name) VALUES (NEW.group_name)
  ON CONFLICT (name) DO NOTHING;
  RETURN NEW;
END;
$$;
-- statement-breakpoint
CREATE OR REPLACE TRIGGER students_ensure_group
BEFORE INSERT OR UPDATE OF group_name ON students
FOR EACH ROW EXECUTE FUNCTION ensure_student_group();
-- statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'students'::REGCLASS AND conname = 'students_group_name_fkey') THEN
    ALTER TABLE students ADD CONSTRAINT students_group_name_fkey
      FOREIGN KEY (group_name) REFERENCES student_groups(name) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END;
$$;
-- statement-breakpoint
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS roster_mode TEXT NOT NULL DEFAULT 'subject'
  CHECK (roster_mode IN ('subject', 'selected'));
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS lesson_students (
  lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  PRIMARY KEY (lesson_id, student_id)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS students_group_name_idx ON students(group_name);
