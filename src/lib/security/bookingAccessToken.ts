import type { NextApiRequest } from 'next';

const normalizeToken = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first.trim() : '';
  }

  return '';
};

const getBookingAccessToken = (req: NextApiRequest): string => {
  const headerToken = normalizeToken(req.headers['x-booking-access-token']);
  if (headerToken) {
    return headerToken;
  }

  const authHeader = normalizeToken(req.headers.authorization);
  if (authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice('Bearer '.length).trim();
    if (bearerToken) {
      return bearerToken;
    }
  }

  const queryToken = normalizeToken(req.query.accessToken);
  if (queryToken) {
    return queryToken;
  }

  return '';
};

export { getBookingAccessToken };
