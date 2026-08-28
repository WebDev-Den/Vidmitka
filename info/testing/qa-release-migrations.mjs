// Independent migration checks; only the harness-created temporary schema is mutated.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { createAttendanceTestDatabase } from './attendance-database.mjs';
const db = await createAttendanceTestDatabase();
const source = neon(process.env.DATABASE_URL);
assert.match(db.schema, /^codex_attendance_test_[0-9a-f]{16}$/);
async function owner(statements) {
  return source.transaction([source.query(`SET LOCAL search_path TO "${db.schema}"`), ...statements.map(s=>source.query(s))]);
}
async function migrate(file) {
  const text = await readFile(new URL(`../../db/migrations/${file}`, import.meta.url),'utf8');
  await owner(text.split('-- statement-breakpoint').filter(s=>s.trim()));
}
try {
  await owner(['ALTER TABLE class_periods DROP COLUMN color']);
  await migrate('011_class_period_colors.sql');
  assert.deepEqual((await db.sql`SELECT color FROM class_periods ORDER BY number`).map(r=>r.color), ['#0F766E','#48C5B5','#16835B','#DED9CD']);
  await db.sql`UPDATE class_periods SET color = '#18283D' WHERE number=2`;
  await db.sql`INSERT INTO makeup_days (held_on,schedule_day,week_type,created_by_user_id,updated_by_user_id) VALUES ('2026-09-04',1,'numerator','administrator','administrator')`;
  await db.sql`UPDATE lesson_types SET is_active = FALSE WHERE name = 'Лабораторна'`;
  const beforePeriods = await db.sql`SELECT * FROM class_periods ORDER BY id`;
  const beforeDays = await db.sql`SELECT * FROM makeup_days ORDER BY held_on`;
  const beforeTypes = await db.sql`SELECT * FROM lesson_types ORDER BY id`;
  for (const f of ['009_makeup_days.sql','010_lesson_types.sql','011_class_period_colors.sql']) await migrate(f);
  assert.deepEqual(await db.sql`SELECT * FROM class_periods ORDER BY id`,beforePeriods);
  assert.deepEqual(await db.sql`SELECT * FROM makeup_days ORDER BY held_on`,beforeDays);
  assert.deepEqual(await db.sql`SELECT * FROM lesson_types ORDER BY id`,beforeTypes);
  await assert.rejects(()=>db.sql`UPDATE class_periods SET color='#A855F7' WHERE number=1`, e=>e.code==='23514');
  const [day] = await db.sql`SELECT * FROM get_schedule_day('2026-09-04'::date)`;
  assert.equal(day.schedule_day,1); assert.equal(day.is_makeup,true);
  console.log('PASS: 011 legacy color backfill; 009/010/011 reapply preserves rows/settings; arbitrary colors rejected; calendar function retained.');
} finally { await db.cleanup(); }
