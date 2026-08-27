import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL не знайдено. Виконайте `vercel env pull .env.local --environment=development --yes`.",
  );
  process.exit(1);
}

const sql = neon(connectionString);
const [result] = await sql`SELECT 1 AS connected`;

if (result?.connected !== 1) {
  throw new Error("Neon Postgres повернув неочікуваний результат перевірки.");
}

console.log("Neon Postgres: з'єднання успішне.");
