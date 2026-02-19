import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from './clientIp';
import { checkRateLimit } from './rateLimit';

const applyAdminRateLimit = async (
  req: NextApiRequest,
  res: NextApiResponse,
  routeKey: string,
): Promise<boolean> => {
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(
    `admin:${routeKey}:${clientIp}`,
    30,
    60_000,
  );

  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many admin requests. Please retry shortly.',
      },
    });
    return false;
  }

  return true;
};

export { applyAdminRateLimit };
