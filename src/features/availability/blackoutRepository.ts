import crypto from 'crypto';

import { queryAll, queryOne, run } from '../../lib/db/sqlite';

type BlackoutInput = {
  scope: 'shop' | 'staff';
  staffId?: string | null;
  startsAt: string;
  endsAt: string;
  reason?: string;
  createdBy?: string;
};

const listBlackoutsInRange = (fromIso: string, toIso: string) =>
  queryAll<any>(
    `SELECT id, scope, staff_id, starts_at, ends_at, reason
     FROM blackout_windows
     WHERE ends_at > ? AND starts_at < ?`,
    [fromIso, toIso],
  );

const hasBookingOverlap = async (input: BlackoutInput) => {
  const row = await queryOne<{ found: number }>(
    `SELECT 1 AS found
     FROM bookings
     WHERE status IN ('confirmed','completed','no_show')
       AND slot_end > ? AND slot_start < ?
       AND (? = 'shop' OR staff_id = ?)
     LIMIT 1`,
    [input.startsAt, input.endsAt, input.scope, input.staffId ?? ''],
  );
  return Boolean(row);
};

const createBlackout = async (input: BlackoutInput) => {
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO blackout_windows (id, scope, staff_id, starts_at, ends_at, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.scope,
      input.staffId ?? null,
      input.startsAt,
      input.endsAt,
      input.reason ?? null,
      input.createdBy ?? null,
    ],
  );
  return { id };
};

const deleteBlackout = async (id: string) =>
  run('DELETE FROM blackout_windows WHERE id = ?', [id]);

export {
  createBlackout,
  deleteBlackout,
  hasBookingOverlap,
  listBlackoutsInRange,
};
