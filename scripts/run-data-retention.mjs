import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error('TURSO_DATABASE_URL is required');
}

const db = createClient({ url, authToken });

const run = async () => {
  await db.execute(`
    UPDATE customers
    SET
      first_name = 'REDACTED',
      last_name = 'REDACTED',
      email = id || '@redacted.local',
      phone = '0000000000'
    WHERE id IN (
      SELECT c.id
      FROM customers c
      JOIN bookings b ON b.customer_id = c.id
      GROUP BY c.id
      HAVING MAX(b.slot_start) < datetime('now', '-365 day')
    )
  `);

  await db.execute(`
    UPDATE booking_notifications
    SET payload = NULL
    WHERE created_at < datetime('now', '-90 day')
  `);

  await db.execute(`
    DELETE FROM admin_audit_events
    WHERE created_at < datetime('now', '-730 day')
  `);

  // eslint-disable-next-line no-console
  console.log('Data retention job complete.');
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
