import type { NextApiRequest, NextApiResponse } from 'next';

import { getBookingByIdWithAccessToken } from '../../../../features/bookings/repository';
import { getBookingAccessToken } from '../../../../lib/security/bookingAccessToken';
import { getClientIp } from '../../../../lib/security/clientIp';
import { checkRateLimit } from '../../../../lib/security/rateLimit';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const rateLimit = await checkRateLimit(
    `bookings:get:${getClientIp(req)}`,
    30,
    60_000,
  );
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again shortly.',
      },
    });
    return;
  }

  const bookingId =
    typeof req.query.bookingId === 'string' ? req.query.bookingId : '';
  if (!bookingId || !UUID_REGEX.test(bookingId)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Valid bookingId is required',
      },
    });
    return;
  }

  const accessToken = getBookingAccessToken(req);
  if (!accessToken) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message:
          'Booking access token is required (x-booking-access-token header, Authorization Bearer token, or accessToken query param).',
      },
    });
    return;
  }

  try {
    const booking = await getBookingByIdWithAccessToken(bookingId, accessToken);
    if (!booking) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Booking was not found',
        },
      });
      return;
    }

    res.status(200).json({ data: booking });
  } catch (error) {
    if (error instanceof Error && error.message === 'BOOKING_ACCESS_DENIED') {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid booking access token',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to retrieve booking at this time',
      },
    });
  }
};

export default handler;
