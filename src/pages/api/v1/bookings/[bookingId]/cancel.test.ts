import type { NextApiRequest, NextApiResponse } from 'next';

import {
  cancelBooking,
  getBookingById,
  verifyBookingAccessToken,
} from '../../../../../features/bookings/repository';
import {
  consumeActionToken,
  verifyActionToken,
} from '../../../../../features/bookings/v2Repository';
import { getBookingAccessToken } from '../../../../../lib/security/bookingAccessToken';
import { getClientIp } from '../../../../../lib/security/clientIp';
import { checkRateLimit } from '../../../../../lib/security/rateLimit';
import handler from './cancel';

jest.mock('../../../../../features/bookings/repository', () => ({
  verifyBookingAccessToken: jest.fn(),
  getBookingById: jest.fn(),
  cancelBooking: jest.fn(),
}));

jest.mock('../../../../../features/bookings/v2Repository', () => ({
  consumeActionToken: jest.fn(),
  logBookingEvent: jest.fn(),
  verifyActionToken: jest.fn(),
}));

jest.mock('../../../../../lib/security/bookingAccessToken', () => ({
  getBookingAccessToken: jest.fn(),
}));

jest.mock('../../../../../lib/security/clientIp', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../../../lib/security/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));

const createReq = (overrides: Partial<NextApiRequest>): NextApiRequest =>
  ({
    method: 'POST',
    query: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    body: {},
    ...overrides,
  }) as NextApiRequest;

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

describe('POST /api/v1/bookings/[bookingId]/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue({
      allowed: true,
      retryAfterSec: 60,
      remaining: 5,
    });
    (getClientIp as jest.Mock).mockReturnValue('127.0.0.1');
  });

  it('invalidates token before applying booking mutation', async () => {
    (getBookingAccessToken as jest.Mock).mockReturnValue('');
    (verifyActionToken as jest.Mock).mockResolvedValue(true);
    (verifyBookingAccessToken as jest.Mock).mockResolvedValue(false);

    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });
    (consumeActionToken as jest.Mock).mockResolvedValue(true);
    (cancelBooking as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      status: 'cancelled',
    });

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: { token: 'cancel-token' },
    });
    const res = createRes();

    await handler(req, res);

    expect(consumeActionToken).toHaveBeenCalledWith('booking-1', 'cancel');
    expect(consumeActionToken).toHaveBeenCalledTimes(1);
    expect(cancelBooking).toHaveBeenCalledWith('booking-1');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('handles uppercase CANCELLED as idempotent and skips mutation', async () => {
    (getBookingAccessToken as jest.Mock).mockReturnValue('access-token');
    (verifyBookingAccessToken as jest.Mock).mockResolvedValue(true);
    (verifyActionToken as jest.Mock).mockResolvedValue(false);
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      status: 'CANCELLED',
    });

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: {},
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({
      id: 'booking-1',
      status: 'cancelled',
      idempotent: true,
    });
    expect(cancelBooking).not.toHaveBeenCalled();
    expect(consumeActionToken).not.toHaveBeenCalled();
  });

  it('treats reused token as invalid after first successful consume', async () => {
    (getBookingAccessToken as jest.Mock).mockReturnValue('');
    (verifyActionToken as jest.Mock).mockResolvedValue(true);
    (verifyBookingAccessToken as jest.Mock).mockResolvedValue(false);
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    (consumeActionToken as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    (cancelBooking as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      status: 'cancelled',
    });

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: { token: 'cancel-token' },
    });

    const firstRes = createRes();
    await handler(req, firstRes);
    expect(firstRes.statusCode).toBe(200);

    const secondRes = createRes();
    await handler(req, secondRes);

    expect(secondRes.statusCode).toBe(403);
    expect(secondRes.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    expect(cancelBooking).toHaveBeenCalledTimes(1);
  });
});
