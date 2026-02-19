import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './availability';

jest.mock('../../../features/availability/repository', () => ({
  listAvailability: jest.fn(async () => []),
}));

jest.mock('../../../features/services/repository', () => ({
  getServiceById: jest.fn(async () => ({
    id: 'svc-1',
    durationMin: 30,
    active: true,
    bookable: true,
    visible: true,
  })),
}));

jest.mock('../../../lib/security/clientIp', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../lib/security/clientFingerprint', () => ({
  getClientFingerprint: jest.fn(() => 'fingerprint-1'),
}));

jest.mock('../../../lib/security/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));

const { checkRateLimit } = jest.requireMock('../../../lib/security/rateLimit') as {
  checkRateLimit: jest.Mock;
};

type MockRes = NextApiResponse & {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
};

const createReq = (): NextApiRequest =>
  ({
    method: 'GET',
    query: {
      serviceId: 'svc-1',
      from: '2026-03-02T17:00:00.000Z',
      to: '2026-03-03T17:00:00.000Z',
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

describe('availability abuse shield', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit
      .mockResolvedValueOnce({ allowed: true, retryAfterSec: 60, remaining: 10 })
      .mockResolvedValueOnce({ allowed: true, retryAfterSec: 60, remaining: 10 });
  });

  it('checks both ip and fingerprint limiters', async () => {
    const req = createReq();
    const res = createRes();

    await handler(req, res);

    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('availability:list:ip:'),
      60,
      60000,
    );
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('availability:list:fingerprint:'),
      60,
      60000,
    );
  });
});
