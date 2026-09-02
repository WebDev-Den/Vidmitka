import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { neon } from "@neondatabase/serverless";

const scrypt = promisify(scryptCallback);
const schemaPattern = /^qa_vid029_[a-f0-9]{16}$/u;

export const qaAdministrator = Object.freeze({
  id: "qa-vid029-administrator",
  email: "qa-admin@example.test",
  password: "QaOnly1!",
  name: "QA Адміністратор",
});

function createScopedClient(client, schemaName) {
  const scope = (query) => {
    query.execute = async () => {
      const results = await client.transaction([
        client`SELECT set_config('search_path', ${schemaName}, true)`,
        query,
      ]);
      return results[1];
    };
    return query;
  };
  const scoped = (strings, ...params) => scope(client(strings, ...params));
  scoped.query = (queryText, params, options) => scope(client.query(queryText, params, options));
  scoped.unsafe = client.unsafe.bind(client);
  scoped.transaction = async (queriesOrFactory, options) => {
    const queries = typeof queriesOrFactory === "function"
      ? queriesOrFactory(scoped)
      : queriesOrFactory;
    const results = await client.transaction([
      client`SELECT set_config('search_path', ${schemaName}, true)`,
      ...queries,
    ], options);
    return results.slice(1);
  };
  return scoped;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16_384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 });
  return ["scrypt", "16384", "8", "5", salt.toString("base64url"), Buffer.from(derived).toString("base64url")].join("$");
}

async function createPrerequisites(sql) {
  await sql.query(`CREATE TABLE app_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    email_normalized TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('administrator', 'teacher')),
    approval_status TEXT NOT NULL CHECK (approval_status IN ('approved', 'pending')),
    approved_at TIMESTAMPTZ,
    approved_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    is_bootstrap_administrator BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.query(`CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.query(`CREATE TABLE class_periods (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    number SMALLINT NOT NULL UNIQUE,
    start_minute SMALLINT NOT NULL,
    end_minute SMALLINT NOT NULL,
    color TEXT NOT NULL DEFAULT '#0F766E',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.query(`CREATE TABLE schedule_week_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    anchor_date DATE NOT NULL,
    anchor_week_type TEXT NOT NULL CHECK (anchor_week_type IN ('numerator', 'denominator')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

async function applyScheduleV2Migration(sql) {
  const source = await readFile(path.resolve(process.cwd(), "db/migrations/014_schedule_v2.sql"), "utf8");
  const statements = source.split("-- statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  return statements.length;
}

async function seedFixture(sql) {
  const passwordHash = await hashPassword(qaAdministrator.password);
  await sql`INSERT INTO app_users (
    id, email, email_normalized, full_name, password_hash, role, approval_status,
    approved_at, is_bootstrap_administrator
  ) VALUES (
    ${qaAdministrator.id}, ${qaAdministrator.email}, ${qaAdministrator.email}, ${qaAdministrator.name},
    ${passwordHash}, 'administrator', 'approved', NOW(), TRUE
  )`;

  const periods = [
    [1, 480, 560], [2, 575, 655], [3, 670, 750], [4, 780, 860],
    [5, 875, 955], [6, 970, 1050], [7, 1065, 1145], [8, 1150, 1230],
  ];
  for (const [number, start, end] of periods) {
    await sql`INSERT INTO class_periods (number, start_minute, end_minute) VALUES (${number}, ${start}, ${end})`;
  }
  await sql`INSERT INTO schedule_week_settings (id, anchor_date, anchor_week_type, semester_start, semester_end)
    VALUES (1, '2026-08-31', 'numerator', '2026-08-31', '2026-12-31')`;

  const groupId = randomUUID(), disciplineId = randomUUID(), typeId = randomUUID();
  const roomId = randomUUID(), teacherId = randomUUID(), entryId = randomUUID();
  await sql`INSERT INTO academic_groups (id, code, code_normalized) VALUES (${groupId}, 'QA-1', 'qa-1')`;
  await sql`INSERT INTO disciplines (id, name, name_normalized) VALUES (${disciplineId}, 'Тестова дисципліна', 'тестова дисципліна')`;
  await sql`INSERT INTO schedule_lesson_types (id, name, name_normalized, color) VALUES (${typeId}, 'Тестове заняття', 'тестове заняття', '#0F766E')`;
  await sql`INSERT INTO schedule_rooms (id, name, name_normalized) VALUES (${roomId}, 'QA-101', 'qa-101')`;
  await sql`INSERT INTO teachers (id, display_name, display_name_normalized) VALUES (${teacherId}, 'Тестовий Викладач', 'тестовий викладач')`;
  const [period] = await sql`SELECT id FROM class_periods WHERE number=2`;
  await sql`INSERT INTO schedule_entries (
    id, discipline_id, lesson_type_id, class_period_id, day_of_week, week_pattern,
    valid_from, valid_until, note, created_by_user_id, updated_by_user_id
  ) VALUES (
    ${entryId}, ${disciplineId}, ${typeId}, ${period.id}, 3, 'both', '2026-08-31', '2026-12-31',
    'Ізольований QA-запис', ${qaAdministrator.id}, ${qaAdministrator.id}
  )`;
  await sql`INSERT INTO schedule_entry_groups (entry_id, group_id) VALUES (${entryId}, ${groupId})`;
  await sql`INSERT INTO schedule_entry_teachers (entry_id, teacher_id) VALUES (${entryId}, ${teacherId})`;
  await sql`INSERT INTO schedule_entry_rooms (entry_id, room_id) VALUES (${entryId}, ${roomId})`;
  return { groupId, disciplineId, typeId, roomId, teacherId, entryId, periodId: String(period.id) };
}

export async function createScheduleV2TestDatabase(baseConnectionString) {
  if (!baseConnectionString || !/^postgres(ql)?:/u.test(baseConnectionString)) {
    throw new Error("Для ізольованого QA потрібен PostgreSQL connection string.");
  }
  const schemaName = `qa_vid029_${randomBytes(8).toString("hex")}`;
  const administratorSql = neon(baseConnectionString);
  await administratorSql.query(`CREATE SCHEMA "${schemaName}"`);
  try {
    const connectionString = baseConnectionString;
    const sql = createScopedClient(administratorSql, schemaName);
    const [scope] = await sql`SELECT current_schema() AS schema_name`;
    if (scope?.schema_name !== schemaName) throw new Error("Не вдалося довести ізоляцію search_path.");
    await createPrerequisites(sql);
    const statementCount = await applyScheduleV2Migration(sql);
    await applyScheduleV2Migration(sql);
    const fixture = await seedFixture(sql);
    return { schemaName, connectionString, sql, fixture, statementCount };
  } catch (error) {
    await administratorSql.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    throw error;
  }
}

export async function destroyScheduleV2TestDatabase(baseConnectionString, schemaName) {
  if (!schemaPattern.test(schemaName)) throw new Error("Відмовлено у видаленні неочікуваної схеми.");
  const sql = neon(baseConnectionString);
  await sql.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
}
