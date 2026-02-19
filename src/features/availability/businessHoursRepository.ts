import { batchWrite, queryAll } from '../../lib/db/sqlite';

type BusinessHour = {
  dayOfWeek: number;
  openTimeLocal: string;
  closeTimeLocal: string;
  timezone: string;
  isOpen: boolean;
};

const listBusinessHours = async (): Promise<BusinessHour[]> => {
  const rows = await queryAll<{
    day_of_week: number;
    open_time_local: string;
    close_time_local: string;
    timezone: string;
    is_open: 0 | 1;
  }>(
    `
      SELECT day_of_week, open_time_local, close_time_local, timezone, is_open
      FROM business_hours
      ORDER BY day_of_week ASC
      `,
  );

  return rows.map((row) => ({
    dayOfWeek: row.day_of_week,
    openTimeLocal: row.open_time_local,
    closeTimeLocal: row.close_time_local,
    timezone: row.timezone,
    isOpen: row.is_open === 1,
  }));
};

const replaceBusinessHours = async (
  entries: BusinessHour[],
): Promise<BusinessHour[]> => {
  await batchWrite([
    { sql: 'DELETE FROM business_hours' },
    ...entries.map((entry) => ({
      sql: `
        INSERT INTO business_hours (id, day_of_week, open_time_local, close_time_local, timezone, is_open)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        `biz_${entry.dayOfWeek}`,
        entry.dayOfWeek,
        entry.openTimeLocal,
        entry.closeTimeLocal,
        entry.timezone,
        entry.isOpen ? 1 : 0,
      ],
    })),
  ]);

  return listBusinessHours();
};

export { listBusinessHours, replaceBusinessHours };
export type { BusinessHour };
