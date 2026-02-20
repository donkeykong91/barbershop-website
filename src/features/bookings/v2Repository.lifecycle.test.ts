jest.mock('../../lib/db/sqlite', () => ({
  run: jest.fn(),
  queryAll: jest.fn(),
  queryOne: jest.fn(),
}));

import { logBookingEvent } from './v2Repository';

const { run } = jest.requireMock('../../lib/db/sqlite') as {
  run: jest.Mock;
};

describe('logBookingEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    'SQLITE_ERROR: no such table: booking_lifecycle_events',
    'SQLITE_ERROR: no such table: main.booking_lifecycle_events',
  ])('self-heals when booking_lifecycle_events table is missing (%s)', async (missingTableError) => {
    run
      .mockRejectedValueOnce(new Error(missingTableError))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(
      logBookingEvent('bk_123', 'booking_confirmed', {
        source: 'unit_test',
      }),
    ).resolves.toBeUndefined();

    expect(run.mock.calls[1]?.[0]).toContain(
      'CREATE TABLE IF NOT EXISTS booking_lifecycle_events',
    );
    expect(run.mock.calls[2]?.[0]).toContain(
      'CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_booking',
    );
    expect(run).toHaveBeenCalledTimes(4);
  });
});
