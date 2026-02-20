import { createBooking } from './repository';

jest.mock('../../lib/db/sqlite', () => ({
  run: jest.fn(),
  queryAll: jest.fn(),
  queryOne: jest.fn(),
}));

jest.mock('../services/repository', () => ({
  getServiceById: jest.fn(),
}));

const { run, queryOne, queryAll } = jest.requireMock('../../lib/db/sqlite') as {
  run: jest.Mock;
  queryOne: jest.Mock;
  queryAll: jest.Mock;
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

    queryOne
      .mockResolvedValueOnce({
        sql: "CREATE TABLE bookings (status TEXT CHECK (status IN ('pending_payment','confirmed','completed','cancelled','payment_failed','no_show')))"
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'cust-1' });
    queryAll.mockResolvedValue([]);

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
    const beginIndex = sqlCalls.findIndex(
      (sql) => sql === 'BEGIN IMMEDIATE' || sql === 'BEGIN',
    );
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

  it('self-heals missing booking notifications/access token columns before writes', async () => {
    queryAll
      .mockResolvedValueOnce([{ name: 'id' }, { name: 'booking_id' }, { name: 'channel' }])
      .mockResolvedValueOnce([{ name: 'booking_id' }]);

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
    ).resolves.toMatchObject({ status: 'confirmed' });

    const sqlCalls = run.mock.calls.map((call) => call[0] as string);

    expect(
      sqlCalls.some((sql) =>
        sql.includes('ALTER TABLE booking_notifications ADD COLUMN status'),
      ),
    ).toBe(true);
    expect(
      sqlCalls.some((sql) =>
        sql.includes('ALTER TABLE booking_notifications ADD COLUMN payload'),
      ),
    ).toBe(true);
    expect(
      sqlCalls.some((sql) =>
        sql.includes('ALTER TABLE booking_access_tokens ADD COLUMN token_hash'),
      ),
    ).toBe(true);
  });

  it('does not fail booking confirmation when notification queue insert fails post-commit', async () => {
    run.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO booking_notifications')) {
        throw new Error('table booking_notifications has no column named payload');
      }

      return { rowsAffected: 1 };
    });

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
    ).resolves.toMatchObject({ status: 'confirmed' });

    const sqlCalls = run.mock.calls.map((call) => call[0] as string);
    expect(sqlCalls).toContain('COMMIT');
    expect(sqlCalls).not.toContain('ROLLBACK');
  });

  it('uses legacy BOOKED status when bookings table schema only allows BOOKED', async () => {
    queryOne
      .mockReset()
      .mockResolvedValueOnce({
        sql: "CREATE TABLE bookings (status TEXT CHECK (status IN ('BOOKED','COMPLETED','NO_SHOW','CANCELLED')))"
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'cust-1' });

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
    ).resolves.toMatchObject({ status: 'confirmed' });

    const insertCall = run.mock.calls.find((call) =>
      (call[0] as string).includes('INSERT INTO bookings'),
    );
    expect(insertCall?.[1]).toContain('BOOKED');
  });

  it('treats COMMIT no-active-transaction errors as post-write success', async () => {
    run.mockImplementation(async (sql: string) => {
      if (sql === 'COMMIT') {
        throw new Error(
          'SQLITE_UNKNOWN: SQLite error: cannot commit - no transaction is active',
        );
      }

      return { rowsAffected: 1 };
    });

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
    ).resolves.toMatchObject({ status: 'confirmed' });
  });

  it('still blocks genuine slot conflicts with SLOT_UNAVAILABLE', async () => {
    queryOne
      .mockReset()
      .mockResolvedValueOnce({
        sql: "CREATE TABLE bookings (status TEXT CHECK (status IN ('pending_payment','confirmed','completed','cancelled','payment_failed','no_show')))"
      })
      .mockResolvedValueOnce({ found: 1 });

    run.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') {
        throw new Error('cannot rollback - no transaction is active');
      }

      return { rowsAffected: 1 };
    });

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
    ).rejects.toThrow('SLOT_UNAVAILABLE');
  });

  it('falls back to BEGIN when BEGIN IMMEDIATE is unsupported', async () => {
    run.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN IMMEDIATE') {
        throw new Error('cannot start a transaction within a transaction');
      }

      return { rowsAffected: 1 };
    });

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
    ).resolves.toMatchObject({ status: 'confirmed' });

    const sqlCalls = run.mock.calls.map((call) => call[0] as string);
    expect(sqlCalls).toContain('BEGIN IMMEDIATE');
    expect(sqlCalls).toContain('BEGIN');
  });
});
