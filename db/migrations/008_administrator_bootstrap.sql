-- Старі адміністратори реєструвалися тільки через код. Позначаємо їх
-- лише під час першого додавання колонки, а не при повторному запуску.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'app_users'
      AND column_name = 'is_bootstrap_administrator'
  ) THEN
    ALTER TABLE app_users ADD COLUMN is_bootstrap_administrator BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE app_users SET is_bootstrap_administrator = TRUE WHERE role = 'administrator';
  END IF;
END
$$;

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app_users'::REGCLASS
      AND conname = 'app_users_bootstrap_administrator_check'
  ) THEN
    ALTER TABLE app_users ADD CONSTRAINT app_users_bootstrap_administrator_check
      CHECK (NOT is_bootstrap_administrator OR (role = 'administrator' AND approval_status = 'approved'));
  END IF;
END
$$;

-- statement-breakpoint

CREATE OR REPLACE FUNCTION protect_bootstrap_administrator() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_bootstrap_administrator THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Захищеного адміністратора не можна видалити.' USING ERRCODE = '23514';
    END IF;
    IF NOT NEW.is_bootstrap_administrator OR NEW.role <> 'administrator' OR NEW.approval_status <> 'approved' THEN
      RAISE EXCEPTION 'Захищеного адміністратора не можна понизити або позбавити доступу.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

-- statement-breakpoint

CREATE OR REPLACE TRIGGER app_users_protect_bootstrap_administrator
BEFORE UPDATE OR DELETE ON app_users
FOR EACH ROW EXECUTE FUNCTION protect_bootstrap_administrator();
