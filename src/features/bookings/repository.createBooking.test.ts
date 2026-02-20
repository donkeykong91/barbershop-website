import { createBooking } from './repository';

jest.mock('../../lib/db/sqlite', () => ({
  run: jest.fn(),
  queryAll: jest.fn(),
  queryOne: jest.fn(),
}));

jest.mock('../services/repository', () => ({
  getServiceById: jest.fn(),
}));

const { run, queryOne } = jest.requireMock('../../lib/db/sqlite') as {
  run: jest.Mock;
  queryOne: jest.Mock;
};

const { getServiceById } = jest.requireMock('../services/repository') as {
  getServiceById: jest.Mock;
};

describe('createBooking schema reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getServiceById.mockResolvedValue({
      id: 'svc-1',
      active: true,
      visible: true,
      bookable: true,
      durationMin: 30,
      priceCents: 3000,
      currency: 'USD',
    });

    queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'cust-1' });

    run.mockResolvedValue({ rowsAffected: 1 });
  });

  it('ensures booking write-time schemas before transaction begins', async () => {
    await expect(
      createBooking({
        serviceId: 'svc-1',
        staffId: 'stf-1',
        slotStart: '2026-03-02T17:00:00.000Z',
        slotEnd: '2026-03-02T17:30:00.000Z',
        customer: {
          firstName: 'Pat',
          lastName: 'Lee',
          email: 'pat@example.com',
          phone: '5551234567',
        },
      }),
    ).resolves.toMatchObject({
      status: 'confirmed',
      totalCents: 3000,
      currency: 'USD',
    });

    const sqlCalls = run.mock.calls.map((call) => call[0] as string);
    const beginIndex = sqlCalls.findIndex((sql) => sql === 'BEGIN IMMEDIATE');
    const notificationsTableIndex = sqlCalls.findIndex((sql) =>
      sql.includes('CREATE TABLE IF NOT EXISTS booking_notifications'),
    );
    const accessTokensTableIndex = sqlCalls.findIndex((sql) =>
      sql.includes('CREATE TABLE IF NOT EXISTS booking_access_tokens'),
    );

    expect(beginIndex).toBeGreaterThan(-1);
    expect(notificationsTableIndex).toBeGreaterThan(-1);
    expect(accessTokensTableIndex).toBeGreaterThan(-1);
    expect(notificationsTableIndex).toBeLessThan(beginIndex);
    expect(accessTokensTableIndex).toBeLessThan(beginIndex);
  });
});
