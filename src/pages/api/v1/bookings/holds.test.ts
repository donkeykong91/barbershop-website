import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './holds';
import {
  createHold,
  refreshHold,
  releaseHold,
} from '../../../../features/bookings/v2Repository';
import { getClientFingerprint } from '../../../../lib/security/clientFingerprint';

jest.mock('../../../../features/bookings/v2Repository', () => ({
  createHold: jest.fn(),
  refreshHold: jest.fn(),
  releaseHold: jest.fn(),
}));

jest.mock('../../../../lib/security/clientFingerprint', () => ({
  getClientFingerprint: jest.fn(() => 'fingerprint-1'),
}));

const createHoldMock = createHold as jest.Mock;
const refreshHoldMock = refreshHold as jest.Mock;
const releaseHoldMock = releaseHold as jest.Mock;
const getClientFingerprintMock = getClientFingerprint as jest.Mock;

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
    end() {
      return this;
    },
  } as unknown as MockRes;

  return res;
};

describe('holds endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects PATCH when holdId is missing', async () => {
    const req = {
      method: 'PATCH',
      query: {},
      body: {},
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as NextApiRequest;

    const res = createRes();
    await handler(req, res);

    expect(getClientFingerprintMock).toHaveBeenCalled();

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for refresh when hold does not exist or is owned by a different fingerprint', async () => {
    refreshHoldMock.mockResolvedValueOnce(null);

    const req = {
      method: 'PATCH',
      query: {},
      body: { holdId: 'missing-hold' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as NextApiRequest;

    const res = createRes();
    await handler(req, res);

    expect(refreshHoldMock).toHaveBeenCalledWith('missing-hold', 'fingerprint-1');
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('HOLD_NOT_FOUND');
  });

  it('returns 404 for delete when hold does not exist', async () => {
    releaseHoldMock.mockResolvedValueOnce({ deleted: false });

    const req = {
      method: 'DELETE',
      query: { holdId: 'missing-hold' },
      body: {},
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as NextApiRequest;

    const res = createRes();
    await handler(req, res);

    expect(releaseHoldMock).toHaveBeenCalledWith('missing-hold');
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('HOLD_NOT_FOUND');
  });

  it('creates and validates hold payload for POST path', async () => {
    createHoldMock.mockResolvedValueOnce({ id: 'hold-1', expiresAt: '2026-01-01T00:00:00.000Z' });

    const req = {
      method: 'POST',
      query: {},
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: {
        serviceId: 'svc-1',
        staffId: 'staff-1',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T11:00:00.000Z',
      },
    } as NextApiRequest;

    const res = createRes();
    await handler(req, res);

    expect(createHoldMock).toHaveBeenCalledWith({
      serviceId: 'svc-1',
      staffId: 'staff-1',
      slotStart: '2026-03-10T10:00:00.000Z',
      slotEnd: '2026-03-10T11:00:00.000Z',
      customerFingerprint: 'fingerprint-1',
    });
    expect(res.statusCode).toBe(201);
  });

  it('returns rate-limit response when too many active holds exist for the fingerprint', async () => {
    createHoldMock.mockRejectedValueOnce(new Error('HOLD_RATE_LIMIT_EXCEEDED'));

    const req = {
      method: 'POST',
      query: {},
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: {
        serviceId: 'svc-1',
        staffId: 'staff-1',
        slotStart: '2026-03-10T10:00:00.000Z',
        slotEnd: '2026-03-10T11:00:00.000Z',
      },
    } as NextApiRequest;

    const res = createRes();
    await handler(req, res);

    expect(createHoldMock).toHaveBeenCalledWith({
      serviceId: 'svc-1',
      staffId: 'staff-1',
      slotStart: '2026-03-10T10:00:00.000Z',
      slotEnd: '2026-03-10T11:00:00.000Z',
      customerFingerprint: 'fingerprint-1',
    });
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
