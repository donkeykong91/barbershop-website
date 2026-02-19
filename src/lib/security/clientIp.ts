import type { NextApiRequest } from 'next';

const TRUST_PROXY_ENV = 'TRUSTED_PROXY_HOPS';

const normalizeIp = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  // Handle IPv4-mapped IPv6 addresses such as ::ffff:127.0.0.1
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length);
  }

  return trimmed;
};

const parseTrustedProxyHops = () => {
  const raw = process.env[TRUST_PROXY_ENV];
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

const parseForwardedFor = (value: string | string[] | undefined) => {
  if (!value) {
    return [] as string[];
  }

  const merged = Array.isArray(value) ? value.join(',') : value;
  return merged
    .split(',')
    .map((part) => normalizeIp(part))
    .filter(Boolean);
};

const getClientIp = (req: NextApiRequest): string => {
  const socketIp = normalizeIp(req.socket.remoteAddress ?? '');
  const trustedProxyHops = parseTrustedProxyHops();

  if (trustedProxyHops <= 0) {
    return socketIp || 'unknown';
  }

  const chain = parseForwardedFor(req.headers['x-forwarded-for']);
  if (chain.length === 0) {
    return socketIp || 'unknown';
  }

  const clientIndex = chain.length - (trustedProxyHops + 1);
  if (clientIndex < 0 || clientIndex >= chain.length) {
    return socketIp || 'unknown';
  }

  return chain[clientIndex] || socketIp || 'unknown';
};

export { getClientIp };
