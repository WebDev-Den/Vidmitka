// Відновлення після примусової зупинки Windows: без аргументу лише показує залишки.
// Видалення дозволене тільки для точного імені власної тимчасової схеми.
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const name = process.argv[2];
if (!name) {
  console.log(await sql`SELECT nspname FROM pg_namespace WHERE nspname LIKE 'codex_attendance_test_%' ORDER BY nspname`);
} else {
  if (!/^codex_attendance_test_[0-9a-f]{16}$/u.test(name)) throw new Error("Unsafe test schema");
  const [exists] = await sql`SELECT nspname FROM pg_namespace WHERE nspname = ${name}`;
  if (!exists) throw new Error("Exact test schema does not exist");
  const [foreignUsers] = await sql.query(`SELECT COUNT(*)::INT AS n FROM "${name}".app_users WHERE email NOT LIKE 'codex.attendance.%@example.test'`);
  if (foreignUsers.n !== 0) throw new Error("Non-test users found; cleanup refused");
  await sql.query(`DROP SCHEMA "${name}" CASCADE`);
  await sql.query(`DROP ROLE "${name}"`);
  console.log(`Removed disposable test schema and role: ${name}`);
}
