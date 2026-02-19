import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './[bookingId]';
import {
  getBookingById,
  updateBookingStatus,
} from '../../../../../features/bookings/repository';
import { recordAdminAuditEvent } from '../../../../../lib/security/adminAudit';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

jest.mock('../../../../../features/bookings/repository', () => ({
  getBookingById: jest.fn(),
  updateBookingStatus: jest.fn(),
}));

jest.mock('../../../../../lib/security/adminAudit', () => ({
  recordAdminAuditEvent: jest.fn(),
}));

jest.mock('../../../../../lib/security/adminAuth', () => ({
  requireAdminApiKey: jest.fn(),
}));

jest.mock('../../../../../lib/security/adminRateLimit', () => ({
  applyAdminRateLimit: jest.fn(),
}));

const createReq = (overrides: Partial<NextApiRequest>): NextApiRequest =>
  ({
    method: 'PATCH',
    query: {},
    body: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
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

describe('PATCH /api/v1/admin/bookings/[bookingId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (applyAdminRateLimit as jest.Mock).mockResolvedValue(true);
    (requireAdminApiKey as jest.Mock).mockResolvedValue(true);
  });

  it('normalizes uppercase incoming status and updates booking', async () => {
    (getBookingById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: { status: 'COMPLETED' },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateBookingStatus).toHaveBeenCalledWith('booking-1', 'completed');
    expect(recordAdminAuditEvent).toHaveBeenCalled();
  });

  it('rejects unknown status values after normalization', async () => {
    const req = createReq({
      query: { bookingId: 'booking-1' },
      body: { status: 'done' },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });
});
