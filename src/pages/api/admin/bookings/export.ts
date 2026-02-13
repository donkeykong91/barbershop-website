import type { NextApiRequest, NextApiResponse } from 'next';

import { queryAll } from '../../../../lib/db/sqlite';
import { requireAdminApiKey } from '../../../../lib/security/adminAuth';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await requireAdminApiKey(req, res))) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' } });
    return;
  }

  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'date=YYYY-MM-DD is required' } });
    return;
  }

  const startIso = `${date}T00:00:00.000Z`;
  const endIso = `${date}T23:59:59.999Z`;

  const rows = await queryAll<any>(
    `SELECT b.slot_start, b.slot_end, c.first_name, c.last_name, c.phone,
            s.name AS service_name, st.display_name AS staff_name,
            b.notes, b.status
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN services s ON s.id = b.service_id
      JOIN staff st ON st.id = b.staff_id
      WHERE b.slot_start >= ? AND b.slot_start <= ?
      ORDER BY b.slot_start ASC, b.id ASC`,
    [startIso, endIso],
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="schedule-${date}.csv"`);
  res.write('time_range,customer_name,phone,service,staff,notes,status\n');
  rows.forEach((row) => {
    const safe = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    res.write([
      safe(`${row.slot_start} - ${row.slot_end}`),
      safe(`${row.first_name} ${row.last_name}`),
      safe(row.phone),
      safe(row.service_name),
      safe(row.staff_name),
      safe(row.notes ?? ''),
      safe(row.status),
    ].join(',') + '\n');
  });
  res.end();
};

export default handler;
