import "server-only";

import {
  neon,
  type NeonQueryFunction,
  type NeonQueryPromise,
} from "@neondatabase/serverless";

// Default Neon options return object rows, not the full query-result envelope.
type DatabaseClient = NeonQueryFunction<false, false>;

let db: DatabaseClient | null = null;
const qaSchemaPattern = /^qa_vid029_[a-f0-9]{16}$/u;

function createScopedQaClient(client: DatabaseClient, schemaName: string): DatabaseClient {
  if (!qaSchemaPattern.test(schemaName)) {
    throw new Error("QA_TEST_SCHEMA має неочікуваний формат; підключення заблоковано.");
  }

  const scope = <T>(query: NeonQueryPromise<false, false, T>) => {
    query.execute = async () => {
      const results = await client.transaction([
        client`SELECT set_config('search_path', ${schemaName}, true)`,
        query,
      ]);
      return results[1] as T;
    };
    return query;
  };

  const scoped = ((strings: TemplateStringsArray, ...params: unknown[]) =>
    scope(client(strings, ...params))) as DatabaseClient;

  scoped.query = ((queryText: string, params?: unknown[], options?: unknown) => {
    const query = client.query(queryText, params, options as never) as NeonQueryPromise<
      false,
      false,
      unknown
    >;
    return scope(query);
  }) as DatabaseClient["query"];
  scoped.unsafe = client.unsafe.bind(client);
  scoped.transaction = (async (queriesOrFactory: unknown, options?: unknown) => {
    const queries = typeof queriesOrFactory === "function"
      ? (queriesOrFactory as (sql: DatabaseClient) => NeonQueryPromise<false, false>[])(scoped)
      : queriesOrFactory as NeonQueryPromise<false, false>[];
    const results = await client.transaction([
      client`SELECT set_config('search_path', ${schemaName}, true)`,
      ...queries,
    ], options as never);
    return results.slice(1);
  }) as DatabaseClient["transaction"];

  return scoped;
}

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

  const client = neon(connectionString);
  const qaSchema = process.env.QA_TEST_SCHEMA;
  db = qaSchema ? createScopedQaClient(client, qaSchema) : client;
  return db;
}
