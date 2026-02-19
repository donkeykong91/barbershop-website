import 'server-only';

import { type Client, createClient, type InArgs } from '@libsql/client';

let dbInstance: Client | null = null;
let initPromise: Promise<void> | null = null;

const getDbClient = (): Client => {
  if (dbInstance) {
    return dbInstance;
  }

  const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is required.');
  }

  dbInstance = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  return dbInstance;
};

const initialize = async () => {
  const client = getDbClient();

  await client.batch(
    [
      { sql: 'PRAGMA foreign_keys = ON;' },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `,
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS seed_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `,
      },
    ],
    'write',
  );
};

const ensureDbInitialized = async () => {
  if (!initPromise) {
    initPromise = initialize();
  }

  await initPromise;
};

const queryAll = async <T>(sql: string, args: InArgs = []): Promise<T[]> => {
  await ensureDbInitialized();
  const result = await getDbClient().execute({ sql, args });
  return result.rows as unknown as T[];
};

const queryOne = async <T>(
  sql: string,
  args: InArgs = [],
): Promise<T | null> => {
  const rows = await queryAll<T>(sql, args);
  return rows[0] ?? null;
};

const run = async (sql: string, args: InArgs = []) => {
  await ensureDbInitialized();
  return getDbClient().execute({ sql, args });
};

const batchWrite = async (
  statements: Array<{ sql: string; args?: InArgs }>,
) => {
  await ensureDbInitialized();
  return getDbClient().batch(statements, 'write');
};

export {
  batchWrite,
  ensureDbInitialized,
  getDbClient as getDb,
  queryAll,
  queryOne,
  run,
};
