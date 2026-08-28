// Порожня ізольована схема та окрема роль. Робочі дані не копіюються.
import { randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

export async function createAttendanceTestDatabase({ seedAdministrator = true, legacyAdministrator = false } = {}) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const source = neon(process.env.DATABASE_URL);
  const schema = `codex_attendance_test_${randomBytes(8).toString("hex")}`;
  if (!/^codex_attendance_test_[0-9a-f]{16}$/u.test(schema)) throw new Error("Unsafe schema");
  const url = new URL(process.env.DATABASE_URL);
  url.hostname = url.hostname.replace("-pooler.", ".");
  url.username = schema;
  url.password = randomBytes(32).toString("hex");
  url.searchParams.delete("options");
  let cleaning;
  const cleanup = () => cleaning ??= (async () => {
    await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await source.query(`DROP ROLE IF EXISTS "${schema}"`);
    console.log("Removed isolated attendance test schema and role.");
  })();
  try {
    await source.query(`CREATE SCHEMA "${schema}"`);
    await source.query(`CREATE ROLE "${schema}" LOGIN PASSWORD '${url.password}'`);
    await source.query(`ALTER ROLE "${schema}" SET search_path TO "${schema}"`);
    const tables = ["app_users", "auth_sessions", "class_periods", "schedule_week_settings", "subjects", "rooms", "students", "teacher_subjects", "subject_students", "lessons", "semester_closures"];
    const [groupTable] = await source`SELECT TO_REGCLASS('public.student_groups') AS name`;
    if (groupTable.name) tables.push("student_groups");
    const [typeTable] = await source`SELECT TO_REGCLASS('public.lesson_types') AS name`;
    if (typeTable.name) tables.push("lesson_types");
    for (const table of tables) await source.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    for (const table of tables) {
      const constraints = await source`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = ${`public.${table}`}::regclass AND contype = 'f'`;
      for (const constraint of constraints) {
        const definition = constraint.definition.replaceAll("REFERENCES public.", `REFERENCES "${schema}".`);
        await source.transaction([
          source.query(`SET LOCAL search_path TO "${schema}"`),
          source.query(`ALTER TABLE "${schema}"."${table}" ADD CONSTRAINT "${constraint.conname}" ${definition}`),
        ]);
      }
    }
    for (const file of ["006_attendance.sql", "007_student_groups_and_lesson_rosters.sql", "008_administrator_bootstrap.sql", "009_makeup_days.sql", "010_lesson_types.sql", "011_class_period_colors.sql"]) {
      if (file === "008_administrator_bootstrap.sql" && legacyAdministrator) {
        // Відтворення старої схеми тільки в щойно створеній тестовій БД.
        await source.query(`ALTER TABLE "${schema}".app_users DROP COLUMN IF EXISTS is_bootstrap_administrator`);
        await source.query(`INSERT INTO "${schema}".app_users
          (id, email, email_normalized, full_name, password_hash, role, approval_status)
          VALUES ('legacy-administrator', 'codex.attendance.legacy@example.test',
          'codex.attendance.legacy@example.test', 'Тест старого адміністратора', 'test-only-unused', 'administrator', 'approved')`);
      }
      const migration = await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), "utf8");
      await source.transaction([
        source.query(`SET LOCAL search_path TO "${schema}"`),
        ...migration.split("-- statement-breakpoint").filter((part) => part.trim()).map((part) => source.query(part)),
      ]);
    }
    await source.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${schema}"`);
    await source.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO "${schema}"`);
    await source.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${schema}"`);
    const sql = neon(url.toString());
    const [scope] = await sql`SELECT current_schema() AS name`;
    if (scope.name !== schema) throw new Error("Test DB is not isolated");
    for (const table of tables) {
      const [access] = await source`SELECT has_table_privilege(${schema}, ${`public.${table}`}, 'INSERT, UPDATE, DELETE') AS allowed`;
      if (access.allowed) throw new Error("Test role can write to live data");
    }
    const salt = randomBytes(16);
    const hash = scryptSync("Codex Attendance Test 2026!", salt, 64, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 });
    const passwordHash = `scrypt$16384$8$5$${salt.toString("base64url")}$${hash.toString("base64url")}`;
    for (const id of ["teacher", "other-teacher", ...(seedAdministrator ? ["administrator"] : [])]) {
      const email = `codex.attendance.${id}@example.test`;
      await sql`INSERT INTO app_users (id, email, email_normalized, full_name, password_hash, role, approval_status)
        VALUES (${id}, ${email}, ${email}, ${`Тест ${id}`}, ${passwordHash}, ${id === "administrator" ? "administrator" : "teacher"}, 'approved')`;
    }
    await sql`INSERT INTO class_periods (number, start_minute, end_minute) VALUES (1, 480, 560), (2, 575, 655), (3, 670, 750), (4, 780, 860)`;
    await sql`INSERT INTO subjects (name) VALUES ('Основи програмування'), ('Математика')`;
    await sql`INSERT INTO rooms (name) VALUES ('101'), ('102')`;
    console.log("Created isolated attendance test database; live table writes denied.");
    return { url: url.toString(), schema, sql, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
