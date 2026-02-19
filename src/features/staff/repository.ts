import crypto from 'crypto';

import { batchWrite, queryAll, queryOne, run } from '../../lib/db/sqlite';
import type { StaffMember } from './types';

type StaffRow = {
  id: string;
  display_name: string;
  active: 0 | 1;
};

type StaffWriteInput = {
  displayName: string;
  email?: string;
  phone?: string;
  active?: boolean;
};

type StaffAvailability = {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
  timezone: string;
  isAvailable: boolean;
};

const mapRow = (row: StaffRow): StaffMember => ({
  id: row.id,
  displayName: row.display_name,
  active: row.active === 1,
});

const listStaff = async (
  options: { includeInactive?: boolean } = {},
): Promise<StaffMember[]> => {
  const rows = await queryAll<StaffRow>(
    `
      SELECT
        id,
        display_name,
        active
      FROM staff
      ${options.includeInactive ? '' : 'WHERE active = 1'}
      ORDER BY display_name ASC
      `,
  );

  return rows.map(mapRow);
};

const createStaff = async (input: StaffWriteInput): Promise<StaffMember> => {
  const id = `stf_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  await run(
    `
    INSERT INTO staff (id, display_name, email, phone, active)
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      id,
      input.displayName.trim(),
      input.email?.trim() ?? null,
      input.phone?.trim() ?? null,
      input.active === false ? 0 : 1,
    ],
  );

  return (await listStaff({ includeInactive: true })).find(
    (item) => item.id === id,
  ) as StaffMember;
};

const updateStaff = async (
  staffId: string,
  patch: Partial<StaffWriteInput>,
): Promise<StaffMember | null> => {
  const existing = await queryOne<StaffRow>(
    'SELECT id, display_name, active FROM staff WHERE id = ? LIMIT 1',
    [staffId],
  );

  if (!existing) {
    return null;
  }

  const displayName = patch.displayName?.trim() ?? existing.display_name;
  const active = patch.active ?? existing.active === 1;

  await run(
    `
    UPDATE staff
    SET display_name = ?,
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        active = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [
      displayName,
      patch.email?.trim() ?? null,
      patch.phone?.trim() ?? null,
      active ? 1 : 0,
      staffId,
    ],
  );

  return (
    (await listStaff({ includeInactive: true })).find(
      (item) => item.id === staffId,
    ) ?? null
  );
};

const listStaffAvailability = async (
  staffId: string,
): Promise<StaffAvailability[]> => {
  const rows = await queryAll<{
    id: string;
    staff_id: string;
    day_of_week: number;
    start_time_local: string;
    end_time_local: string;
    timezone: string;
    is_available: 0 | 1;
  }>(
    `
      SELECT id, staff_id, day_of_week, start_time_local, end_time_local, timezone, is_available
      FROM staff_availability
      WHERE staff_id = ?
      ORDER BY day_of_week ASC, start_time_local ASC
      `,
    [staffId],
  );

  return rows.map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    dayOfWeek: row.day_of_week,
    startTimeLocal: row.start_time_local,
    endTimeLocal: row.end_time_local,
    timezone: row.timezone,
    isAvailable: row.is_available === 1,
  }));
};

const replaceStaffAvailability = async (
  staffId: string,
  entries: Array<{
    dayOfWeek: number;
    startTimeLocal: string;
    endTimeLocal: string;
    timezone: string;
    isAvailable: boolean;
  }>,
): Promise<StaffAvailability[]> => {
  await batchWrite([
    {
      sql: 'DELETE FROM staff_availability WHERE staff_id = ?',
      args: [staffId],
    },
    ...entries.map((entry) => ({
      sql: `
        INSERT INTO staff_availability (id, staff_id, day_of_week, start_time_local, end_time_local, timezone, is_available)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        staffId,
        entry.dayOfWeek,
        entry.startTimeLocal,
        entry.endTimeLocal,
        entry.timezone,
        entry.isAvailable ? 1 : 0,
      ],
    })),
  ]);

  return listStaffAvailability(staffId);
};

export {
  createStaff,
  listStaff,
  listStaffAvailability,
  replaceStaffAvailability,
  updateStaff,
};
export type { StaffAvailability, StaffWriteInput };
