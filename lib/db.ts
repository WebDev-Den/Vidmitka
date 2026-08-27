import "server-only";

import { neon } from "@neondatabase/serverless";

let db: ReturnType<typeof neon> | null = null;

/**
 * Повертає ліниво створений серверний клієнт Neon Postgres.
 * DATABASE_URL перевіряється лише під час фактичного звернення до БД,
 * тому збірка застосунку не падає до налаштування середовища.
 */
export function getDb(): ReturnType<typeof neon> {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL не налаштовано. Виконайте `vercel env pull .env.local --environment=development --yes`.",
    );
  }

  db = neon(connectionString);
  return db;
}
