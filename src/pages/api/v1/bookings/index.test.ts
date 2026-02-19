import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './index';

jest.mock('../../../../features/availability/repository', () => ({
  listAvailability: jest.fn(),
}));

jest.mock('../../../../features/bookings/repository', () => ({
  createBooking: jest.fn(),
  logBookingLegalConsent: jest.fn(),
}));

jest.mock('../../../../features/services/repository', () => ({
  getServiceById: jest.fn(),
}));

jest.mock('../../../../features/bookings/v2Repository', () => ({
  getValidHold: jest.fn(),
  releaseHold: jest.fn(),
  logBookingEvent: jest.fn(),
}));

jest.mock('../../../../lib/security/clientIp', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../../lib/security/clientFingerprint', () => ({
  getClientFingerprint: jest.fn(() => 'abc123fingerprint'),
}));

jest.mock('../../../../lib/security/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));

const { listAvailability } = jest.requireMock(
  '../../../../features/availability/repository',
) as { listAvailability: jest.Mock };
const { createBooking } = jest.requireMock(
  '../../../../features/bookings/repository',
) as { createBooking: jest.Mock };
const { getServiceById } = jest.requireMock(
  '../../../../features/services/repository',
) as { getServiceById: jest.Mock };
const { checkRateLimit } = jest.requireMock(
  '../../../../lib/security/rateLimit',
) as { checkRateLimit: jest.Mock };
const { getValidHold } = jest.requireMock(
  '../../../../features/bookings/v2Repository',
) as { getValidHold: jest.Mock };

type MockRes = NextApiResponse & {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
};

const baseReq = (): NextApiRequest =>
  ({
    method: 'POST',
    query: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    body: {
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
      consent: {
        agreeToTerms: true,
        agreeToPrivacy: true,
        agreeToBookingPolicies: true,
      },
      holdId: 'hold-1',
    },
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

describe('POST /api/v1/bookings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit
      .mockResolvedValueOnce({ allowed: true, retryAfterSec: 60, remaining: 7 })
      .mockResolvedValueOnce({
        allowed: true,
        retryAfterSec: 60,
        remaining: 7,
      });

    getServiceById.mockResolvedValue({
      id: 'svc-1',
      durationMin: 30,
      active: true,
      visible: true,
      bookable: true,
      priceCents: 3000,
      currency: 'USD',
    });
    getValidHold.mockResolvedValue({
      id: 'hold-1',
      serviceId: 'svc-1',
      staffId: 'stf-1',
      slotStart: '2026-03-02T17:00:00.000Z',
      slotEnd: '2026-03-02T17:30:00.000Z',
    });
  });

  it('returns SLOT_TAKEN with alternatives payload on conflict', async () => {
    listAvailability.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        slotStart: '2026-03-02T17:30:00.000Z',
        slotEnd: '2026-03-02T18:00:00.000Z',
        staffId: 'stf-1',
      },
    ]);

    const req = baseReq();
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
    expect(res.body.error.alternatives).toHaveLength(1);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('rejects requests when hold is expired', async () => {
    listAvailability.mockResolvedValueOnce([
      {
        slotStart: '2026-03-02T17:00:00.000Z',
        slotEnd: '2026-03-02T17:30:00.000Z',
        staffId: 'stf-1',
      },
    ]);
    getValidHold.mockResolvedValueOnce(null);

    const req = baseReq();
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('HOLD_EXPIRED');
  });

  it('applies dual limiter keys for ip and fingerprint', async () => {
    listAvailability.mockResolvedValueOnce([
      {
        slotStart: '2026-03-02T17:00:00.000Z',
        slotEnd: '2026-03-02T17:30:00.000Z',
        staffId: 'stf-1',
      },
    ]);
    createBooking.mockResolvedValue({
      id: 'bk-1',
      status: 'confirmed',
      totalCents: 3000,
      currency: 'USD',
      accessToken: 'token',
    });

    const req = baseReq();
    const res = createRes();

    await handler(req, res);

    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('bookings:create:ip:'),
      8,
      60000,
    );
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('bookings:create:fingerprint:'),
      8,
      60000,
    );
  });
});
