import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './index';

jest.mock('../../../../../features/bookings/repository', () => ({
  listBookings: jest.fn(),
}));

jest.mock('../../../../../lib/security/adminAuth', () => ({
  requireAdminApiKey: jest.fn(() => true),
}));

jest.mock('../../../../../lib/security/adminRateLimit', () => ({
  applyAdminRateLimit: jest.fn(() => true),
}));

const { listBookings } = jest.requireMock(
  '../../../../../features/bookings/repository',
) as {
  listBookings: jest.Mock;
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

describe('admin bookings list pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes legacy uppercase status filter values', async () => {
    listBookings.mockResolvedValue([]);

    const req = createReq({
      method: 'GET',
      query: { status: 'BOOKED' },
    });
    const res = createRes();

    await handler(req, res);

    expect(listBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
      }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('enforces max page size and emits pagination metadata', async () => {
    listBookings.mockResolvedValue([
      {
        id: 'b-3',
        status: 'confirmed',
        totalCents: 3000,
        currency: 'USD',
        serviceId: 'svc',
        staffId: 'stf',
        slotStart: '2026-02-13T17:00:00.000Z',
        slotEnd: '2026-02-13T17:30:00.000Z',
      },
      {
        id: 'b-2',
        status: 'confirmed',
        totalCents: 3000,
        currency: 'USD',
        serviceId: 'svc',
        staffId: 'stf',
        slotStart: '2026-02-13T16:30:00.000Z',
        slotEnd: '2026-02-13T17:00:00.000Z',
      },
    ]);

    const req = createReq({
      method: 'GET',
      query: { limit: '500' },
    });
    const res = createRes();

    await handler(req, res);

    expect(listBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 101,
        includeCustomer: false,
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.meta).toEqual(
      expect.objectContaining({
        limit: 100,
        count: 2,
      }),
    );
  });
});
