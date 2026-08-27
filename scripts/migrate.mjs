import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL_UNPOOLED або DATABASE_URL не знайдено. Виконайте `vercel env pull .env.local --environment=development --yes`.",
  );
  process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(scriptDirectory, "../db/migrations");
const sql = neon(connectionString);

await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const files = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const [existing] = await sql`
    SELECT name
    FROM schema_migrations
    WHERE name = ${file}
  `;

  if (existing) {
    console.log(`Пропущено ${file}: уже застосовано.`);
    continue;
  }

  const source = await readFile(path.join(migrationsDirectory, file), "utf8");
  const statements = source
    .split("-- statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  await sql`
    INSERT INTO schema_migrations (name)
    VALUES (${file})
  `;
  console.log(`Застосовано ${file}.`);
}
