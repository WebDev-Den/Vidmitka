CREATE TABLE IF NOT EXISTS lesson_types (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 100 AND name = BTRIM(name)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS lesson_types_name_unique ON lesson_types(LOWER(name));
-- statement-breakpoint
INSERT INTO lesson_types (name) VALUES ('Лекція'), ('Практична'), ('Лабораторна') ON CONFLICT DO NOTHING;
-- statement-breakpoint
-- Старі заняття не отримують вигаданого типу; NULL означає «Тип не вказано».
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS lesson_type_id BIGINT REFERENCES lesson_types(id) ON DELETE RESTRICT;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS lessons_lesson_type_idx ON lessons(lesson_type_id);
-- statement-breakpoint
-- Історичний знімок, незалежний від подальшого перейменування довідника.
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS lesson_type_name TEXT;
