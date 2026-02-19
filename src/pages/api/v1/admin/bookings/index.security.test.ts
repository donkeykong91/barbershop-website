import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './index';

jest.mock('../../../../../features/bookings/repository', () => ({
  listBookings: jest.fn(),
}));

jest.mock('../../../../../lib/security/adminAuth', () => ({
  requireAdminApiKey: jest.fn(async () => true),
}));

jest.mock('../../../../../lib/security/adminRateLimit', () => ({
  applyAdminRateLimit: jest.fn(async () => true),
}));

const { listBookings } = jest.requireMock(
  '../../../../../features/bookings/repository',
) as {
  listBookings: jest.Mock;
};

const createRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as any,
    setHeader: jest.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as unknown as NextApiResponse;

  return res;
};

describe('admin bookings listing hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces max page size and returns pagination metadata', async () => {
    listBookings.mockResolvedValue([
      {
        id: 'b2',
        status: 'confirmed',
        totalCents: 1000,
        currency: 'USD',
        serviceId: 's',
        staffId: 'st',
        slotStart: '2026-02-10T10:00:00.000Z',
        slotEnd: '2026-02-10T10:30:00.000Z',
      },
      {
        id: 'b1',
        status: 'confirmed',
        totalCents: 1000,
        currency: 'USD',
        serviceId: 's',
        staffId: 'st',
        slotStart: '2026-02-10T09:00:00.000Z',
        slotEnd: '2026-02-10T09:30:00.000Z',
      },
    ]);

    const req = {
      method: 'GET',
      query: { limit: '500' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as NextApiRequest;
    const res = createRes() as any;

    await handler(req, res);

    expect(listBookings).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 101, includeCustomer: false }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.meta).toEqual(
      expect.objectContaining({ count: 2, limit: 100, nextCursor: null }),
    );
    expect(res.body.data[0].customer).toBeUndefined();
  });
});
