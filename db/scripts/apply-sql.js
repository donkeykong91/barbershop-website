/* eslint-disable no-console, no-restricted-syntax, no-await-in-loop, no-continue */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const mode = process.argv[2];
if (!mode || !['migrations', 'seeds'].includes(mode)) {
  console.error('Usage: node db/scripts/apply-sql.js <migrations|seeds>');
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('Missing TURSO_DATABASE_URL');
  process.exit(1);
}

const client = createClient({ url, authToken });

const splitSqlStatements = (sql) =>
  sql
    .split(/;\s*(?:\r?\n|$)/g)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => `${statement};`);

const run = async () => {
  await client.batch(
    [
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

  const dir = path.join(process.cwd(), 'db', mode);
  const trackingTable =
    mode === 'migrations' ? 'schema_migrations' : 'seed_migrations';
  const files = fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of files) {
    const result = await client.execute({
      sql: `SELECT 1 FROM ${trackingTable} WHERE filename = ? LIMIT 1`,
      args: [fileName],
    });

    if (result.rows.length > 0) {
      console.log(`skip ${mode}/${fileName}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, fileName), 'utf8');
    const statements = splitSqlStatements(sql);

    await client.batch(
      [
        ...statements.map((statement) => ({ sql: statement })),
        {
          sql: `INSERT INTO ${trackingTable} (filename) VALUES (?)`,
          args: [fileName],
        },
      ],
      'write',
    );

    console.log(`applied ${mode}/${fileName}`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
