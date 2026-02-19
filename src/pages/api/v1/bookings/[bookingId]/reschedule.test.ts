import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './reschedule';
import { getBookingById, updateBookingStatus, assertRescheduleSlot } from '../../../../../features/bookings/repository';
import {
  createActionToken,
  consumeActionToken,
  verifyActionToken,
} from '../../../../../features/bookings/v2Repository';
import { run } from '../../../../../lib/db/sqlite';
import { checkRateLimit } from '../../../../../lib/security/rateLimit';

jest.mock('../../../../../features/bookings/repository', () => ({
  assertRescheduleSlot: jest.fn(),
  getBookingById: jest.fn(),
  updateBookingStatus: jest.fn(),
}));

jest.mock('../../../../../features/bookings/v2Repository', () => ({
  createActionToken: jest.fn(),
  consumeActionToken: jest.fn(),
  verifyActionToken: jest.fn(),
  logBookingEvent: jest.fn(),
}));

jest.mock('../../../../../lib/db/sqlite', () => ({
  run: jest.fn(),
}));

jest.mock('../../../../../lib/security/clientIp', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../../../lib/security/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, retryAfterSec: 60, remaining: 5 })),
}));

const runMock = run as jest.Mock;

const createReq = (overrides: Partial<NextApiRequest>): NextApiRequest => ({
  method: 'POST',
  query: {},
  headers: {},
  socket: { remoteAddress: '127.0.0.1' },
  body: {},
  ...overrides,
} as NextApiRequest);

type MockRes = NextApiResponse & {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
};

const createRes = (): MockRes => {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as unknown as MockRes;

  return res;
};

describe('reschedule endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runMock.mockResolvedValue({ rows: [] } as never);
    (checkRateLimit as jest.Mock).mockReturnValue({
      allowed: true,
      retryAfterSec: 60,
      remaining: 5,
    });
  });

  it('issues action token via GET', async () => {
    (createActionToken as jest.Mock).mockResolvedValueOnce({ token: 'abc', expiresAt: '' });

    const req = createReq({ method: 'GET', query: { bookingId: 'booking-1' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(createActionToken).toHaveBeenCalledWith('booking-1', 'reschedule');
  });

  it('rejects non-string token payloads with validation error', async () => {
    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: { bad: true },
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T10:30:00.000Z',
      },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(verifyActionToken).not.toHaveBeenCalled();
  });

  it('rejects malformed slot payloads with validation error', async () => {
    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'good',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: ['2026-03-10T10:30:00.000Z'],
      },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(verifyActionToken).not.toHaveBeenCalled();
  });

  it('rejects invalid token', async () => {
    (verifyActionToken as jest.Mock).mockResolvedValue(false);

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'bad',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T10:30:00.000Z',
      },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    expect(consumeActionToken).not.toHaveBeenCalled();
  });

  it('validates slot shape and ordering before mutate', async () => {
    (verifyActionToken as jest.Mock).mockResolvedValue(true);
    (assertRescheduleSlot as jest.Mock).mockRejectedValue(new Error('INVALID_SLOT_RANGE'));
    (consumeActionToken as jest.Mock).mockResolvedValue(true);
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      staffId: 'stf-1',
      serviceId: 'svc-1',
      slotStart: '2026-03-10T09:00:00.000Z',
      status: 'confirmed',
    });

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'good',
        slotStart: 'bad-time',
        slotEnd: 'bad-time',
      },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SLOT_RANGE');
    expect(runMock).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rejects conflicting slot with explicit conflict code', async () => {
    (verifyActionToken as jest.Mock).mockResolvedValue(true);
    (assertRescheduleSlot as jest.Mock).mockRejectedValue(new Error('SLOT_UNAVAILABLE'));
    (consumeActionToken as jest.Mock).mockResolvedValue(true);
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      slotStart: '2026-03-10T09:00:00.000Z',
    });

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'good',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T10:30:00.000Z',
      },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect(consumeActionToken).toHaveBeenCalledWith('booking-1', 'reschedule');
  });

  it('rejects uppercase terminal statuses from admin canonical writes', async () => {
    (verifyActionToken as jest.Mock).mockResolvedValue(true);
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      slotStart: '2026-03-10T09:00:00.000Z',
      serviceId: 'svc-1',
      staffId: 'stf-1',
      status: 'COMPLETED',
    });

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'good',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T10:30:00.000Z',
      },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_NOT_RESCHEDULABLE');
    expect(consumeActionToken).not.toHaveBeenCalled();
    expect(assertRescheduleSlot).not.toHaveBeenCalled();
  });

  it('consumes action token and updates slot on valid request', async () => {
    (verifyActionToken as jest.Mock).mockResolvedValue(true);
    (assertRescheduleSlot as jest.Mock).mockResolvedValue(undefined);
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      slotStart: '2026-03-10T09:00:00.000Z',
      serviceId: 'svc-1',
      staffId: 'stf-1',
      status: 'confirmed',
    });
    (consumeActionToken as jest.Mock).mockResolvedValue(true);

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'good',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T10:30:00.000Z',
      },
    });
    const res = createRes();

    await handler(req, res);

    expect(consumeActionToken).toHaveBeenCalledWith('booking-1', 'reschedule');
    expect(runMock).toHaveBeenCalledWith('BEGIN IMMEDIATE');
    expect(runMock).toHaveBeenCalledWith('COMMIT');
    expect(updateBookingStatus).toHaveBeenCalledWith('booking-1', 'confirmed');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.slotStart).toBe('2026-03-10T10:00:00.000Z');
  });

  it('prevents replay of a consumed reschedule token across repeated requests', async () => {
    (verifyActionToken as jest.Mock).mockResolvedValue(true);
    (assertRescheduleSlot as jest.Mock).mockResolvedValue(undefined);
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      slotStart: '2026-03-10T09:00:00.000Z',
      serviceId: 'svc-1',
      staffId: 'stf-1',
      status: 'confirmed',
    });

    let consumeCount = 0;
    (consumeActionToken as jest.Mock).mockImplementation(async () => {
      consumeCount += 1;
      return consumeCount === 1;
    });

    const req1 = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'good',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T10:30:00.000Z',
      },
    });
    const res1 = createRes();

    await handler(req1, res1);

    const req2 = createReq({
      query: { bookingId: 'booking-1' },
      body: {
        token: 'good',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T10:30:00.000Z',
      },
    });
    const res2 = createRes();

    await handler(req2, res2);

    expect(consumeActionToken).toHaveBeenCalledTimes(2);
    expect(verifyActionToken).toHaveBeenCalledTimes(2);
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(403);
    expect(res2.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    expect(consumeActionToken).toHaveBeenCalledWith('booking-1', 'reschedule');
    expect(assertRescheduleSlot).toHaveBeenCalledTimes(1);
    expect(updateBookingStatus).toHaveBeenCalledTimes(1);
  });
});
