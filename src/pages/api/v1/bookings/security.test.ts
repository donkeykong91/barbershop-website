import type { NextApiRequest, NextApiResponse } from 'next';

import bookingHandler from './[bookingId]';
import cancelHandler from './[bookingId]/cancel';
import confirmationHandler from './[bookingId]/confirmation';

jest.mock('../../../../features/bookings/repository', () => ({
  getBookingByIdWithAccessToken: jest.fn(),
  verifyBookingAccessToken: jest.fn(),
  cancelBooking: jest.fn(),
  getBookingById: jest.fn(),
  getBookingConfirmation: jest.fn(),
}));

jest.mock('../../../../features/bookings/v2Repository', () => ({
  verifyActionToken: jest.fn(),
  consumeActionToken: jest.fn(),
  logBookingEvent: jest.fn(),
  createActionToken: jest.fn(),
}));

jest.mock('../../../../lib/security/clientIp', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../../lib/security/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({
    allowed: true,
    retryAfterSec: 60,
    remaining: 9,
  })),
}));

const {
  getBookingByIdWithAccessToken,
  verifyBookingAccessToken,
  cancelBooking,
  getBookingById,
  getBookingConfirmation,
} = jest.requireMock('../../../../features/bookings/repository') as {
  getBookingByIdWithAccessToken: jest.Mock;
  verifyBookingAccessToken: jest.Mock;
  cancelBooking: jest.Mock;
  getBookingById: jest.Mock;
  getBookingConfirmation: jest.Mock;
};

const { checkRateLimit } = jest.requireMock(
  '../../../../lib/security/rateLimit',
) as {
  checkRateLimit: jest.Mock;
};

const { consumeActionToken, verifyActionToken } = jest.requireMock(
  '../../../../features/bookings/v2Repository',
) as {
  consumeActionToken: jest.Mock;
  verifyActionToken: jest.Mock;
};

type MockRes = NextApiResponse & {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
};

const createReq = (overrides: Partial<NextApiRequest>): NextApiRequest =>
  ({
    method: 'GET',
    query: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as NextApiRequest;

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

describe('booking protected endpoint hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockReturnValue({
      allowed: true,
      retryAfterSec: 60,
      remaining: 9,
    });
  });

  it('rejects query-string access token on booking read endpoint', async () => {
    const req = createReq({
      method: 'GET',
      query: {
        bookingId: '11111111-1111-4111-8111-111111111111',
        accessToken: 'leaky',
      },
    });
    const res = createRes();

    await bookingHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(getBookingByIdWithAccessToken).not.toHaveBeenCalled();
  });

  it('rejects query-string access-token on cancel and confirmation endpoints', async () => {
    const cancelReq = createReq({
      method: 'POST',
      query: { bookingId: 'b-1', accessToken: 'leaky' },
    });
    const cancelRes = createRes();

    await cancelHandler(cancelReq, cancelRes);

    expect(cancelRes.statusCode).toBe(401);

    const confirmationReq = createReq({
      method: 'GET',
      query: { bookingId: 'b-1', accessToken: 'leaky' },
    });
    const confirmationRes = createRes();

    await confirmationHandler(confirmationReq, confirmationRes);

    expect(confirmationRes.statusCode).toBe(401);
    expect(verifyBookingAccessToken).not.toHaveBeenCalled();
  });

  it('rejects sensitive cancel action token in query string', async () => {
    verifyActionToken.mockResolvedValue(true);

    const cancelReq = createReq({
      method: 'POST',
      query: { bookingId: 'b-1', token: 'leaky' },
      body: {},
    });
    const cancelRes = createRes();

    await cancelHandler(cancelReq, cancelRes);

    expect(cancelRes.statusCode).toBe(401);
    expect(verifyActionToken).not.toHaveBeenCalled();
    expect(consumeActionToken).not.toHaveBeenCalled();
  });

  it('consumes valid cancel action token after successful idempotent or stateful cancel', async () => {
    verifyBookingAccessToken.mockResolvedValue(false);
    verifyActionToken.mockResolvedValue(true);
    getBookingById.mockResolvedValue({
      id: 'b-1',
      status: 'confirmed',
    });
    cancelBooking.mockResolvedValue({ id: 'b-1', status: 'cancelled' });

    const cancelReq = createReq({
      method: 'POST',
      query: { bookingId: 'b-1' },
      body: { token: 'abc' },
    });
    const cancelRes = createRes();

    await cancelHandler(cancelReq, cancelRes);

    expect(consumeActionToken).toHaveBeenCalledWith('b-1', 'cancel');
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');
  });

  it('throttles cancel/confirmation brute-force attempts with retry-after', async () => {
    checkRateLimit
      .mockReturnValueOnce({ allowed: false, retryAfterSec: 45, remaining: 0 })
      .mockReturnValueOnce({ allowed: true, retryAfterSec: 60, remaining: 5 });

    const cancelReq = createReq({
      method: 'POST',
      query: { bookingId: 'b-1' },
      headers: { 'x-booking-access-token': 't' },
    });
    const cancelRes = createRes();

    await cancelHandler(cancelReq, cancelRes);
    expect(cancelRes.statusCode).toBe(429);
    expect(cancelRes.headers['Retry-After']).toBe('60');

    checkRateLimit
      .mockReturnValueOnce({ allowed: true, retryAfterSec: 60, remaining: 5 })
      .mockReturnValueOnce({ allowed: false, retryAfterSec: 30, remaining: 0 });

    const confirmationReq = createReq({
      method: 'GET',
      query: { bookingId: 'b-1' },
      headers: { authorization: 'Bearer t' },
    });
    const confirmationRes = createRes();

    await confirmationHandler(confirmationReq, confirmationRes);
    expect(confirmationRes.statusCode).toBe(429);
    expect(confirmationRes.headers['Retry-After']).toBe('60');
  });

  it('returns sanitized 500 response on unexpected cancel/confirmation errors', async () => {
    verifyBookingAccessToken.mockResolvedValue(true);
    cancelBooking.mockRejectedValue(new Error('db failed'));

    const cancelReq = createReq({
      method: 'POST',
      query: { bookingId: 'b-1' },
      headers: { authorization: 'Bearer t' },
    });
    const cancelRes = createRes();

    await cancelHandler(cancelReq, cancelRes);
    expect(cancelRes.statusCode).toBe(500);
    expect(cancelRes.body.error.code).toBe('INTERNAL_ERROR');

    getBookingConfirmation.mockRejectedValue(new Error('db failed'));

    const confirmationReq = createReq({
      method: 'GET',
      query: { bookingId: 'b-1' },
      headers: { authorization: 'Bearer t' },
    });
    const confirmationRes = createRes();

    await confirmationHandler(confirmationReq, confirmationRes);
    expect(confirmationRes.statusCode).toBe(500);
    expect(confirmationRes.body.error.code).toBe('INTERNAL_ERROR');
  });
});
