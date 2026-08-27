CREATE EXTENSION IF NOT EXISTS btree_gist;

-- statement-breakpoint

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS teacher_user_id TEXT;

-- statement-breakpoint

UPDATE lessons AS lesson
SET teacher_user_id = teacher_subject.teacher_user_id
FROM teacher_subjects AS teacher_subject
WHERE
  lesson.teacher_subject_id = teacher_subject.id
  AND lesson.teacher_user_id IS NULL;

-- statement-breakpoint

ALTER TABLE lessons
ALTER COLUMN teacher_user_id SET NOT NULL;

-- statement-breakpoint

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS week_span INT4RANGE
GENERATED ALWAYS AS (
  CASE week_type
    WHEN 'numerator' THEN INT4RANGE(1, 2, '[)')
    WHEN 'denominator' THEN INT4RANGE(2, 3, '[)')
    ELSE INT4RANGE(1, 3, '[)')
  END
) STORED;

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lessons_no_teacher_overlap'
  ) THEN
    ALTER TABLE lessons
    ADD CONSTRAINT lessons_no_teacher_overlap
    EXCLUDE USING GIST (
      teacher_user_id WITH =,
      day_of_week WITH =,
      class_period_id WITH =,
      week_span WITH &&
    );
  END IF;
END
$$;

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lessons_no_room_overlap'
  ) THEN
    ALTER TABLE lessons
    ADD CONSTRAINT lessons_no_room_overlap
    EXCLUDE USING GIST (
      room_id WITH =,
      day_of_week WITH =,
      class_period_id WITH =,
      week_span WITH &&
    );
  END IF;
END
$$;
