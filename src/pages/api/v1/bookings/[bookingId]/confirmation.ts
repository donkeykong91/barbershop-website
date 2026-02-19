import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getBookingConfirmation,
  verifyBookingAccessToken,
} from '../../../../../features/bookings/repository';
import { getBookingAccessToken } from '../../../../../lib/security/bookingAccessToken';
import { getClientIp } from '../../../../../lib/security/clientIp';
import { checkRateLimit } from '../../../../../lib/security/rateLimit';

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

  const bookingId =
    typeof req.query.bookingId === 'string' ? req.query.bookingId : '';

  if (!bookingId) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'bookingId is required',
      },
    });
    return;
  }

  const clientIp = getClientIp(req);
  const perIpLimit = await checkRateLimit(
    `bookings:confirmation:ip:${clientIp}`,
    10,
    60_000,
  );
  const perBookingLimit = await checkRateLimit(
    `bookings:confirmation:booking:${bookingId}:ip:${clientIp}`,
    5,
    60_000,
  );

  res.setHeader(
    'X-RateLimit-Remaining',
    Math.min(perIpLimit.remaining, perBookingLimit.remaining).toString(),
  );

  if (!perIpLimit.allowed || !perBookingLimit.allowed) {
    const retryAfterSec = Math.max(
      perIpLimit.retryAfterSec,
      perBookingLimit.retryAfterSec,
    );
    res.setHeader('Retry-After', retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again shortly.',
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
          'Booking access token is required (x-booking-access-token header or Bearer token).',
      },
    });
    return;
  }

  const hasValidAccessToken = await verifyBookingAccessToken(
    bookingId,
    accessToken,
  );
  if (!hasValidAccessToken) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid booking access token',
      },
    });
    return;
  }

  try {
    const confirmation = await getBookingConfirmation(bookingId);
    res.status(200).json({ data: confirmation });
  } catch (error) {
    if (error instanceof Error && error.message === 'BOOKING_NOT_FOUND') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Booking was not found',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to retrieve booking confirmation at this time',
      },
    });
  }
};

export default handler;
