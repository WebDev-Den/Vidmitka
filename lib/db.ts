import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Default Neon options return object rows, not the full query-result envelope.
type DatabaseClient = NeonQueryFunction<false, false>;

let db: DatabaseClient | null = null;

/**
 * Повертає ліниво створений серверний клієнт Neon Postgres.
 * DATABASE_URL перевіряється лише під час фактичного звернення до БД,
 * тому збірка застосунку не падає до налаштування середовища.
 */
export function getDb(): DatabaseClient {
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
