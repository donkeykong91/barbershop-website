import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './index';

jest.mock('../../../../features/bookings/repository', () => ({
  getBookingByIdWithAccessToken: jest.fn(),
}));

jest.mock('../../../../lib/security/clientIp', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../../lib/security/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));

type MockRes = NextApiResponse & {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
};

const { getBookingByIdWithAccessToken } = jest.requireMock(
  '../../../../features/bookings/repository',
) as {
  getBookingByIdWithAccessToken: jest.Mock;
};
const { checkRateLimit } = jest.requireMock(
  '../../../../lib/security/rateLimit',
) as { checkRateLimit: jest.Mock };

const baseReq = (): NextApiRequest =>
  ({
    method: 'GET',
    query: {
      bookingId: '8f7aab3a-9d4a-4d9f-9a9d-7f8e9f1f5a12',
      accessToken: 'query-token',
    },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
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

describe('GET /api/v1/bookings/[bookingId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSec: 60,
      remaining: 20,
    });
  });

  it('accepts query accessToken for authorization and returns booking', async () => {
    const booking = {
      id: '8f7aab3a-9d4a-4d9f-9a9d-7f8e9f1f5a12',
      status: 'confirmed',
    };
    getBookingByIdWithAccessToken.mockResolvedValue(booking);

    const req = baseReq();
    const res = createRes();

    await handler(req, res);

    expect(checkRateLimit).toHaveBeenCalled();
    expect(getBookingByIdWithAccessToken).toHaveBeenCalledWith(
      '8f7aab3a-9d4a-4d9f-9a9d-7f8e9f1f5a12',
      'query-token',
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: booking });
  });

  it('rejects requests with missing access token', async () => {
    const req = baseReq();
    req.query.accessToken = undefined;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(getBookingByIdWithAccessToken).not.toHaveBeenCalled();
  });
});
