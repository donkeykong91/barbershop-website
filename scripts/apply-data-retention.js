const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.DATABASE_URL || 'file:./db/kevinbarbershop.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const run = async () => {
  const anonymizeResult = await client.execute(`
    UPDATE customers
    SET
      first_name = 'Redacted',
      last_name = 'Customer',
      email = 'redacted-' || substr(id, 1, 8) || '@redacted.local',
      phone = '0000000000'
    WHERE id IN (
      SELECT c.id
      FROM customers c
      JOIN bookings b ON b.customer_id = c.id
      GROUP BY c.id
      HAVING MAX(b.slot_end) < datetime('now', '-365 day')
    )
  `);

  const pruneNotificationsResult = await client.execute(`
    UPDATE booking_notifications
    SET payload = NULL
    WHERE created_at < datetime('now', '-90 day')
      AND payload IS NOT NULL
  `);

  console.log(
    JSON.stringify(
      {
        anonymizedCustomers: anonymizeResult.rowsAffected,
        prunedNotificationPayloads: pruneNotificationsResult.rowsAffected,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error('data-retention job failed', error);
  process.exit(1);
});
