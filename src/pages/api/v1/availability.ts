import type { NextApiRequest, NextApiResponse } from 'next';

import { listAvailability } from '../../../features/availability/repository';
import { getServiceById } from '../../../features/services/repository';
import { getClientFingerprint } from '../../../lib/security/clientFingerprint';
import { getClientIp } from '../../../lib/security/clientIp';
import { checkRateLimit } from '../../../lib/security/rateLimit';

const MAX_RANGE_DAYS = 14;

const parseIsoDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getRateLimitConfig = (
  key: 'AVAILABILITY_LIST_MAX' | 'AVAILABILITY_LIST_WINDOW_MS',
  fallback: number,
) => {
  const configured = Number.parseInt(process.env[key] ?? '', 10);
  if (Number.isNaN(configured) || configured < 1) {
    return fallback;
  }

  return configured;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET is supported on this endpoint',
      },
    });
    return;
  }

  const maxRequests = getRateLimitConfig('AVAILABILITY_LIST_MAX', 60);
  const windowMs = getRateLimitConfig('AVAILABILITY_LIST_WINDOW_MS', 60_000);
  const clientIp = getClientIp(req);
  const clientFingerprint = getClientFingerprint(req);

  const [ipLimit, fingerprintLimit] = await Promise.all([
    checkRateLimit(`availability:list:ip:${clientIp}`, maxRequests, windowMs),
    checkRateLimit(
      `availability:list:fingerprint:${clientFingerprint}`,
      maxRequests,
      windowMs,
    ),
  ]);

  const effectiveLimit = ipLimit.allowed ? fingerprintLimit : ipLimit;
  res.setHeader(
    'X-RateLimit-Remaining',
    Math.min(ipLimit.remaining, fingerprintLimit.remaining).toString(),
  );

  if (!ipLimit.allowed || !fingerprintLimit.allowed) {
    res.setHeader('Retry-After', effectiveLimit.retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many availability requests. Please try again shortly.',
        retryAfterSec: effectiveLimit.retryAfterSec,
      },
    });
    console.warn('[security] availability_rate_limited', {
      ip: clientIp,
      fingerprintPrefix: clientFingerprint.slice(0, 8),
      route: '/api/v1/availability',
    });
    return;
  }

  const serviceId =
    typeof req.query.serviceId === 'string' ? req.query.serviceId : '';
  const staffId =
    typeof req.query.staffId === 'string' ? req.query.staffId : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';

  if (!serviceId || !from || !to) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'serviceId, from and to are required query params',
      },
    });
    return;
  }

  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);

  if (!fromDate || !toDate || fromDate >= toDate) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'from and to must be valid ISO dates and from < to',
      },
    });
    return;
  }

  const maxToDate = new Date(
    fromDate.getTime() + MAX_RANGE_DAYS * 24 * 60 * 60 * 1000,
  );
  if (toDate > maxToDate) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Availability range cannot exceed ${MAX_RANGE_DAYS} days`,
      },
    });
    return;
  }

  const service = await getServiceById(serviceId);
  if (!service || !service.active || !service.bookable || !service.visible) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Service not found or unavailable',
      },
    });
    return;
  }

  const data = await listAvailability({
    serviceDurationMin: service.durationMin,
    fromIso: fromDate.toISOString(),
    toIso: toDate.toISOString(),
    ...(staffId && staffId !== 'any' ? { staffId } : {}),
  });

  res.status(200).json({ data });
};

export default handler;
