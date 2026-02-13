import type { NextApiRequest, NextApiResponse } from 'next';

import {
  cancelBooking,
  getBookingById,
  verifyBookingAccessToken,
} from '../../../../../features/bookings/repository';
import { logBookingEvent, verifyActionToken } from '../../../../../features/bookings/v2Repository';
import { getBookingAccessToken } from '../../../../../lib/security/bookingAccessToken';
import { getClientIp } from '../../../../../lib/security/clientIp';
import { checkRateLimit } from '../../../../../lib/security/rateLimit';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is supported on this endpoint',
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
    `bookings:cancel:ip:${clientIp}`,
    10,
    60_000,
  );
  const perBookingLimit = await checkRateLimit(
    `bookings:cancel:booking:${bookingId}:ip:${clientIp}`,
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
  const bodyToken = typeof req.body?.token === 'string' ? req.body.token : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';

  const hasValidAccessToken =
    (accessToken && (await verifyBookingAccessToken(bookingId, accessToken))) ||
    (bodyToken && (await verifyActionToken(bookingId, 'cancel', bodyToken))) ||
    (queryToken && (await verifyActionToken(bookingId, 'cancel', queryToken)));

  if (!hasValidAccessToken) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid or expired cancel token',
      },
    });
    return;
  }

  try {
    const existing = await getBookingById(bookingId);
    if (existing?.status === 'cancelled') {
      res.status(200).json({ data: { id: bookingId, status: 'cancelled', idempotent: true } });
      return;
    }

    const booking = await cancelBooking(bookingId);
    await logBookingEvent(bookingId, 'booking_cancelled_by_customer');
    res.status(200).json({
      data: {
        id: booking.id,
        status: booking.status,
      },
    });
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

    if (error instanceof Error && error.message === 'BOOKING_NOT_CANCELLABLE') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Booking cannot be cancelled from its current state',
        },
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === 'CANCELLATION_CUTOFF_REACHED'
    ) {
      res.status(409).json({
        error: {
          code: 'CANCELLATION_CUTOFF_REACHED',
          message: 'Cancellation cutoff has passed for this booking',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to cancel booking at this time',
      },
    });
  }
};

export default handler;
