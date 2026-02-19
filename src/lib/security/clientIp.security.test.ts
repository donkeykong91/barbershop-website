import type { NextApiRequest } from 'next';

import { getClientIp } from './clientIp';

type ReqOverrides = Partial<NextApiRequest> & {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | null };
};

const createReq = (overrides: ReqOverrides = {}): NextApiRequest =>
  ({
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as NextApiRequest;

describe('getClientIp trusted-proxy behavior', () => {
  const originalTrustedProxyHops = process.env.TRUSTED_PROXY_HOPS;

  afterEach(() => {
    if (originalTrustedProxyHops === undefined) {
      delete process.env.TRUSTED_PROXY_HOPS;
    } else {
      process.env.TRUSTED_PROXY_HOPS = originalTrustedProxyHops;
    }
  });

  it('ignores spoofed x-forwarded-for when TRUSTED_PROXY_HOPS is unset', () => {
    delete process.env.TRUSTED_PROXY_HOPS;

    const req = createReq({
      headers: { 'x-forwarded-for': '198.51.100.123, 203.0.113.8' },
      socket: { remoteAddress: '10.0.0.5' },
    });

    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('uses forwarded chain when trusted proxy hops are configured', () => {
    process.env.TRUSTED_PROXY_HOPS = '1';

    const req = createReq({
      headers: { 'x-forwarded-for': '198.51.100.22, 203.0.113.7' },
      socket: { remoteAddress: '10.0.0.7' },
    });

    expect(getClientIp(req)).toBe('198.51.100.22');
  });
});
