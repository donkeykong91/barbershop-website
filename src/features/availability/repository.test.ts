import { listAvailability } from './repository';

jest.mock('../../lib/db/sqlite', () => ({
  queryAll: jest.fn(),
}));

jest.mock('../staff/repository', () => ({
  listStaff: jest.fn(),
}));

jest.mock('./businessHoursRepository', () => ({
  listBusinessHours: jest.fn(),
}));

jest.mock('./blackoutRepository', () => ({
  listBlackoutsInRange: jest.fn(),
}));

const { queryAll } = jest.requireMock('../../lib/db/sqlite') as {
  queryAll: jest.Mock;
};
const { listStaff } = jest.requireMock('../staff/repository') as {
  listStaff: jest.Mock;
};
const { listBusinessHours } = jest.requireMock('./businessHoursRepository') as {
  listBusinessHours: jest.Mock;
};
const { listBlackoutsInRange } = jest.requireMock('./blackoutRepository') as {
  listBlackoutsInRange: jest.Mock;
};

describe('availability repository time bounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    listStaff.mockResolvedValue([{ id: 'stf_kevin', active: true }]);
    listBusinessHours.mockResolvedValue(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        openTimeLocal: '09:00',
        closeTimeLocal: '17:00',
        timezone: 'America/Los_Angeles',
        isOpen: true,
      })),
    );

    queryAll
      .mockResolvedValueOnce(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          staff_id: 'stf_kevin',
          day_of_week: dayOfWeek,
          start_time_local: '00:00',
          end_time_local: '23:59',
          is_available: 1,
        })),
      )
      .mockResolvedValueOnce([]);

    listBlackoutsInRange.mockResolvedValue([]);
  });

  it('excludes slots intersecting blackout windows', async () => {
    listBlackoutsInRange.mockResolvedValueOnce([
      {
        scope: 'staff',
        staff_id: 'stf_kevin',
        starts_at: '2026-02-16T17:00:00.000Z',
        ends_at: '2026-02-16T18:00:00.000Z',
      },
    ]);

    const slots = await listAvailability({
      serviceDurationMin: 30,
      fromIso: '2026-02-16T16:00:00.000Z',
      toIso: '2026-02-16T20:00:00.000Z',
      staffId: 'stf_kevin',
    });

    expect(slots.some((slot) => slot.slotStart >= '2026-02-16T17:00:00.000Z' && slot.slotStart < '2026-02-16T18:00:00.000Z')).toBe(false);
  });

  it('generates daily slots inside local 9:00 AM–5:00 PM business hours', async () => {
    const slots = await listAvailability({
      serviceDurationMin: 30,
      fromIso: '2026-02-16T08:00:00.000Z',
      toIso: '2026-02-19T08:00:00.000Z',
      staffId: 'stf_kevin',
    });

    expect(slots.length).toBeGreaterThan(0);

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const toShopParts = (iso: string) => {
      const parts = formatter.formatToParts(new Date(iso));
      const findValue = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value ?? 0);

      const month = findValue('month');
      const day = findValue('day');
      const hour = findValue('hour');
      const minute = findValue('minute');

      return {
        dateKey: `${month}-${day}`,
        minutes: hour * 60 + minute,
      };
    };

    const slotsByDate = new Map<
      string,
      Array<{ start: number; end: number }>
    >();

    slots.forEach((slot) => {
      const start = toShopParts(slot.slotStart);
      const end = toShopParts(slot.slotEnd);
      const existing = slotsByDate.get(start.dateKey) ?? [];
      existing.push({ start: start.minutes, end: end.minutes });
      slotsByDate.set(start.dateKey, existing);
    });

    expect(slotsByDate.size).toBeGreaterThanOrEqual(3);

    const allStartMinutes = [...slotsByDate.values()].flatMap((dailySlots) =>
      dailySlots.map((slot) => slot.start),
    );
    const allEndMinutes = [...slotsByDate.values()].flatMap((dailySlots) =>
      dailySlots.map((slot) => slot.end),
    );

    expect(allStartMinutes.every((minute) => minute >= 9 * 60)).toBe(true);
    expect(allEndMinutes.every((minute) => minute <= 17 * 60)).toBe(true);
  });
});
