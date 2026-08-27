// Лише локальний функціональний тест. Жодних робочих записів не копіює.
// Запуск: node --env-file=.env.local info/testing/week-settings-server.mjs
import { randomBytes, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const source = neon(process.env.DATABASE_URL);
const schema = `codex_week_test_${randomBytes(8).toString("hex")}`;
if (!/^codex_week_test_[0-9a-f]{16}$/u.test(schema)) throw new Error("Unsafe test schema");
const testUrl = new URL(process.env.DATABASE_URL);
testUrl.hostname = testUrl.hostname.replace("-pooler.", ".");
const testPassword = randomBytes(32).toString("hex");
testUrl.username = schema;
testUrl.password = testPassword;
testUrl.searchParams.delete("options");
const testSql = neon(testUrl.toString());
let child;
let cleanupPromise;

function cleanup() {
  cleanupPromise ??= (async () => {
    if (child && child.exitCode === null) child.kill();
    // Ідентифікатор згенеровано вище; видаляється тільки схема цього запуску.
    await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await source.query(`DROP ROLE IF EXISTS "${schema}"`);
    console.log(`Removed isolated test schema and role: ${schema}`);
  })();
  return cleanupPromise;
}

try {
  await source.query(`CREATE SCHEMA "${schema}"`);
  await source.query(`CREATE ROLE "${schema}" LOGIN PASSWORD '${testPassword}'`);
  // HTTP-драйвер не застосовує options із URL. Окремий тестовий користувач
  // має власний search_path і права виключно на тимчасові таблиці.
  await source.query(`ALTER ROLE "${schema}" SET search_path TO "${schema}"`);
  for (const table of ["app_users", "auth_sessions", "schedule_week_settings"]) {
    await source.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
  }
  await source.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${schema}"`);
  await source.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO "${schema}"`);
  const [scope] = await testSql`SELECT current_schema() AS name`;
  if (scope.name !== schema) throw new Error("Test connection is not isolated");
  for (const table of ["app_users", "auth_sessions", "schedule_week_settings"]) {
    const [access] = await source`
      SELECT has_table_privilege(${schema}, ${`public.${table}`}, 'INSERT, UPDATE, DELETE') AS allowed
    `;
    if (access.allowed) throw new Error("Test role can write to a live table");
  }
  const salt = randomBytes(16);
  const hash = scryptSync("Codex Week Test 2026!", salt, 64, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 });
  const passwordHash = `scrypt$16384$8$5$${salt.toString("base64url")}$${hash.toString("base64url")}`;
  for (const role of ["administrator", "teacher"]) {
    const email = `codex.week.${role}@example.test`;
    await testSql`
      INSERT INTO app_users (id, email, email_normalized, full_name, password_hash, role, approval_status)
      VALUES (${role}, ${email}, ${email}, ${`Тест ${role}`}, ${passwordHash}, ${role}, 'approved')
    `;
  }

  console.log(`Isolated test schema: ${schema}`);
  console.log("Local test URL: http://localhost:3000/sign-in");
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      ADMIN_EMAILS: "codex.week.administrator@example.test",
      ADMIN_REGISTRATION_TOKEN: randomBytes(24).toString("hex"),
    },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => void cleanup().then(() => process.exit(0)));
  }
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code ? reject(new Error(`Test server exited with ${code}`)) : resolve());
  });
} finally {
  await cleanup();
}
