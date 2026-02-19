import { queryAll } from '../../lib/db/sqlite';
import { listStaff } from '../staff/repository';
import { listBlackoutsInRange } from './blackoutRepository';
import { listBusinessHours } from './businessHoursRepository';

type AvailabilitySlot = {
  slotStart: string;
  slotEnd: string;
  staffId: string;
};

type AvailabilityWindow = {
  staff_id: string;
  day_of_week: number;
  start_time_local: string;
  end_time_local: string;
  is_available: 0 | 1;
};

type BookingRow = {
  staff_id: string;
  slot_start: string;
  slot_end: string;
};

type ListAvailabilityInput = {
  serviceDurationMin: number;
  fromIso: string;
  toIso: string;
  staffId?: string;
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const ACTIVE_BLOCKING_STATUSES = [
  'confirmed',
  'completed',
  'no_show',
  'BOOKED',
  'COMPLETED',
  'NO_SHOW',
];
const SLOT_GRANULARITY_MIN = 15;

const toMinutes = (hhmm: string): number => {
  const parts = hhmm.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  return hours * 60 + minutes;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string) => {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }

  return formatterCache.get(timeZone)!;
};

const getZonedDateParts = (value: Date, timeZone: string): ZonedDateParts => {
  const parts = getFormatter(timeZone).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
};

const zonedLocalDateTimeToUtc = (
  dateParts: Omit<ZonedDateParts, 'hour' | 'minute'>,
  minutesOfDay: number,
  timeZone: string,
): Date => {
  const targetHour = Math.floor(minutesOfDay / 60);
  const targetMinute = minutesOfDay % 60;

  let utcMillis = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    targetHour,
    targetMinute,
    0,
    0,
  );

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = getZonedDateParts(new Date(utcMillis), timeZone);
    const desiredAsUtc = Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      targetHour,
      targetMinute,
      0,
      0,
    );
    const currentAsUtc = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      0,
      0,
    );
    const diffMillis = desiredAsUtc - currentAsUtc;

    if (diffMillis === 0) {
      break;
    }

    utcMillis += diffMillis;
  }

  return new Date(utcMillis);
};

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const getLocalDateRange = (from: Date, to: Date, timeZone: string) => {
  const start = getZonedDateParts(from, timeZone);
  const end = getZonedDateParts(new Date(to.getTime() - 1), timeZone);

  const dates: Array<{
    year: number;
    month: number;
    day: number;
    dayOfWeek: number;
  }> = [];
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endKey = formatDateKey(end.year, end.month, end.day);

  for (;;) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();

    dates.push({
      year,
      month,
      day,
      dayOfWeek: cursor.getUTCDay(),
    });

    if (formatDateKey(year, month, day) === endKey) {
      break;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const listAvailability = async ({
  serviceDurationMin,
  fromIso,
  toIso,
  staffId,
}: ListAvailabilityInput): Promise<AvailabilitySlot[]> => {
  const from = new Date(fromIso);
  const to = new Date(toIso);

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to
  ) {
    return [];
  }

  const staffMembers = await listStaff();
  const targetStaff = staffId
    ? staffMembers.filter((member) => member.id === staffId)
    : staffMembers;

  if (targetStaff.length === 0) {
    return [];
  }

  const availabilityRows = await queryAll<AvailabilityWindow>(
    `
      SELECT
        staff_id,
        day_of_week,
        start_time_local,
        end_time_local,
        is_available
      FROM staff_availability
      WHERE is_available = 1
      `,
  );

  const allowedStaffIds = new Set(targetStaff.map((member) => member.id));
  const availabilityByStaffDay = new Map<string, AvailabilityWindow[]>();

  availabilityRows
    .filter((row) => allowedStaffIds.has(row.staff_id))
    .forEach((row) => {
      const key = `${row.staff_id}:${row.day_of_week}`;
      const list = availabilityByStaffDay.get(key) ?? [];
      list.push(row);
      availabilityByStaffDay.set(key, list);
    });

  const bookingRows = await queryAll<BookingRow>(
    `
      SELECT
        staff_id,
        slot_start,
        slot_end
      FROM bookings
      WHERE status IN (${ACTIVE_BLOCKING_STATUSES.map(() => '?').join(',')})
        AND slot_end > ?
        AND slot_start < ?
      `,
    [...ACTIVE_BLOCKING_STATUSES, from.toISOString(), to.toISOString()],
  );
  const blackouts = await listBlackoutsInRange(
    from.toISOString(),
    to.toISOString(),
  );

  const businessHoursByDay = new Map(
    (await listBusinessHours()).map((entry) => [entry.dayOfWeek, entry]),
  );
  const defaultTimezone =
    Array.from(businessHoursByDay.values())[0]?.timezone ??
    'America/Los_Angeles';

  const bookingsByStaff = new Map<string, BookingRow[]>();
  bookingRows.forEach((booking) => {
    if (!allowedStaffIds.has(booking.staff_id)) {
      return;
    }

    const rows = bookingsByStaff.get(booking.staff_id) ?? [];
    rows.push(booking);
    bookingsByStaff.set(booking.staff_id, rows);
  });

  const slots: AvailabilitySlot[] = [];
  const localDates = getLocalDateRange(from, to, defaultTimezone);

  localDates.forEach((localDate) => {
    const businessHour = businessHoursByDay.get(localDate.dayOfWeek);

    targetStaff.forEach((member) => {
      if (!businessHour || !businessHour.isOpen) {
        return;
      }

      const timezone = businessHour.timezone || defaultTimezone;
      const businessOpenMin = toMinutes(businessHour.openTimeLocal);
      const businessCloseMin = toMinutes(businessHour.closeTimeLocal);
      const key = `${member.id}:${localDate.dayOfWeek}`;
      const windows = availabilityByStaffDay.get(key) ?? [];

      windows.forEach((window) => {
        const windowStartMin = Math.max(
          toMinutes(window.start_time_local),
          businessOpenMin,
        );
        const windowEndMin = Math.min(
          toMinutes(window.end_time_local),
          businessCloseMin,
        );

        for (
          let minute = windowStartMin;
          minute + serviceDurationMin <= windowEndMin;
          minute += SLOT_GRANULARITY_MIN
        ) {
          const slotStart = zonedLocalDateTimeToUtc(
            localDate,
            minute,
            timezone,
          );
          const slotEnd = new Date(
            slotStart.getTime() + serviceDurationMin * 60_000,
          );

          const isInRequestedWindow = slotStart >= from && slotEnd <= to;

          if (isInRequestedWindow) {
            const overlapsExisting = (
              bookingsByStaff.get(member.id) ?? []
            ).some((booking) => {
              const bookedStart = new Date(booking.slot_start);
              const bookedEnd = new Date(booking.slot_end);
              return slotStart < bookedEnd && slotEnd > bookedStart;
            });

            const overlapsBlackout = blackouts.some((blackout) => {
              const blockedStart = new Date(blackout.starts_at);
              const blockedEnd = new Date(blackout.ends_at);
              const appliesToStaff =
                blackout.scope === 'shop' || blackout.staff_id === member.id;
              return (
                appliesToStaff &&
                slotStart < blockedEnd &&
                slotEnd > blockedStart
              );
            });

            if (!overlapsExisting && !overlapsBlackout) {
              slots.push({
                slotStart: slotStart.toISOString(),
                slotEnd: slotEnd.toISOString(),
                staffId: member.id,
              });
            }
          }
        }
      });
    });
  });

  return slots.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
};

export {
  getLocalDateRange,
  getZonedDateParts,
  listAvailability,
  zonedLocalDateTimeToUtc,
};
export type { AvailabilitySlot, ListAvailabilityInput };
