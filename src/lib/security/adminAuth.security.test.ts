import type { NextApiRequest, NextApiResponse } from 'next';

import { requireAdminApiKey } from './adminAuth';

jest.mock('../db/sqlite', () => ({
  queryOne: jest.fn(),
  run: jest.fn(),
}));

jest.mock('./clientIp', () => ({
  getClientIp: jest.fn(() => '127.0.0.25'),
}));

jest.mock('./rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));

const { checkRateLimit } = jest.requireMock('./rateLimit') as {
  checkRateLimit: jest.Mock;
};

describe('admin auth rate limiting', () => {
  const originalKey = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = 'super-secret';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.ADMIN_API_KEY = originalKey;
  });

  const createRes = () => {
    const res = {
      statusCode: 200,
      body: undefined as any,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
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

  it('throttles repeated invalid admin key attempts', async () => {
    checkRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSec: 60,
      remaining: 0,
    });

    const req = {
      headers: { 'x-admin-key': 'bad' },
      socket: { remoteAddress: '127.0.0.25' },
    } as unknown as NextApiRequest;
    const res = createRes() as any;

    const allowed = await requireAdminApiKey(req, res);

    expect(allowed).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['Retry-After']).toBe('60');
  });
});
