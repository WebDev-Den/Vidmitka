// node --env-file=.env.local info/testing/administrator-migration-check.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { createAttendanceTestDatabase } from "./attendance-database.mjs";

const db = await createAttendanceTestDatabase({ seedAdministrator: false, legacyAdministrator: true });
try {
  const [legacy] = await db.sql`SELECT is_bootstrap_administrator AS protected FROM app_users WHERE id = 'legacy-administrator'`;
  assert.equal(legacy.protected, true);
  for (const statement of [
    "UPDATE app_users SET role = 'teacher' WHERE id = 'legacy-administrator'",
    "UPDATE app_users SET is_bootstrap_administrator = FALSE WHERE id = 'legacy-administrator'",
    "UPDATE app_users SET approval_status = 'pending' WHERE id = 'legacy-administrator'",
    "DELETE FROM app_users WHERE id = 'legacy-administrator'",
  ]) {
    await assert.rejects(() => db.sql.query(statement), (error) => error.code === "23514");
  }
  // Повторне застосування не робить призначеного адміністратора захищеним.
  await db.sql`UPDATE app_users SET role = 'administrator' WHERE id = 'teacher'`;
  const migration = await readFile(new URL("../../db/migrations/008_administrator_bootstrap.sql", import.meta.url), "utf8");
  const source = neon(process.env.DATABASE_URL);
  assert.match(db.schema, /^codex_attendance_test_[0-9a-f]{16}$/u);
  await source.transaction([
    source.query(`SET LOCAL search_path TO "${db.schema}"`),
    ...migration.split("-- statement-breakpoint").filter((part) => part.trim()).map((part) => source.query(part)),
  ]);
  const [appointed] = await db.sql`SELECT is_bootstrap_administrator AS protected FROM app_users WHERE id = 'teacher'`;
  assert.equal(appointed.protected, false);
  console.log("Administrator migration: legacy protection, 4 database guards and idempotent reapply passed.");
} finally { await db.cleanup(); }
