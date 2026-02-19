#!/usr/bin/env node
import { createClient } from '@libsql/client';

const isDryRun = process.argv.includes('--dry-run');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('TURSO_DATABASE_URL is required');
  process.exit(1);
}

const db = createClient({ url, authToken });

const exec = async (sql, args = []) => db.execute({ sql, args });

const retention = {
  piiMonths: 18,
  notificationDays: 90,
  auditMonths: 24,
};

const previewQueries = [
  {
    label: 'customers to anonymize',
    sql: `
      SELECT COUNT(*) AS count
      FROM customers c
      WHERE EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.customer_id = c.id
        GROUP BY b.customer_id
        HAVING MAX(datetime(b.slot_start)) < datetime('now', ?)
      )
    `,
    args: [`-${retention.piiMonths} months`],
  },
  {
    label: 'notification payload rows to clear',
    sql: `
      SELECT COUNT(*) AS count
      FROM booking_notifications
      WHERE payload IS NOT NULL
        AND datetime(created_at) < datetime('now', ?)
    `,
    args: [`-${retention.notificationDays} days`],
  },
  {
    label: 'audit rows to delete',
    sql: `
      SELECT COUNT(*) AS count
      FROM admin_audit_events
      WHERE datetime(created_at) < datetime('now', ?)
    `,
    args: [`-${retention.auditMonths} months`],
  },
];

const printPreview = async () => {
  for (const query of previewQueries) {
    const result = await exec(query.sql, query.args);
    const count = Number(result.rows?.[0]?.count ?? 0);
    console.log(`${query.label}: ${count}`);
  }
};

const runPurge = async () => {
  await exec(
    `
      UPDATE customers
      SET
        first_name = 'REDACTED',
        last_name = 'REDACTED',
        email = 'redacted+' || id || '@example.invalid',
        phone = 'REDACTED'
      WHERE id IN (
        SELECT customer_id
        FROM bookings
        GROUP BY customer_id
        HAVING MAX(datetime(slot_start)) < datetime('now', ?)
      )
    `,
    [`-${retention.piiMonths} months`],
  );

  await exec(
    `
      UPDATE booking_notifications
      SET payload = NULL
      WHERE payload IS NOT NULL
        AND datetime(created_at) < datetime('now', ?)
    `,
    [`-${retention.notificationDays} days`],
  );

  await exec(
    `
      DELETE FROM admin_audit_events
      WHERE datetime(created_at) < datetime('now', ?)
    `,
    [`-${retention.auditMonths} months`],
  );
};

console.log(`Data retention purge (${isDryRun ? 'dry-run' : 'apply'})`);
await printPreview();

if (!isDryRun) {
  await runPurge();
  console.log('Purge complete.');
}
