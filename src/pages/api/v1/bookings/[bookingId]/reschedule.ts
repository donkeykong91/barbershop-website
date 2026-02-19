import type { NextApiRequest, NextApiResponse } from 'next';

import {
  assertRescheduleSlot,
  getBookingById,
  updateBookingStatus,
} from '../../../../../features/bookings/repository';
import {
  createActionToken,
  consumeActionToken,
  logBookingEvent,
  verifyActionToken,
} from '../../../../../features/bookings/v2Repository';

import { run } from '../../../../../lib/db/sqlite';
import { getClientIp } from '../../../../../lib/security/clientIp';
import { checkRateLimit } from '../../../../../lib/security/rateLimit';

const TERMINAL_BOOKING_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

const normalizeStatus = (status: unknown): string =>
  typeof status === 'string' ? status.trim().toLowerCase() : '';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const bookingId =
    typeof req.query.bookingId === 'string' ? req.query.bookingId : '';
  if (!bookingId) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' },
    });
    return;
  }

  if (req.method === 'GET') {
    const tokenData = await createActionToken(bookingId, 'reschedule');
    res.status(200).json({ data: tokenData });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST');
    res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported method' },
    });
    return;
  }

  const ip = getClientIp(req);
  const limit = await checkRateLimit(`bookings:reschedule:ip:${ip}`, 8, 60_000);
  if (!limit.allowed) {
    res.setHeader('Retry-After', limit.retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many reschedule attempts',
        retryAfterSec: limit.retryAfterSec,
      },
    });
    return;
  }

  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const slotStart = typeof req.body?.slotStart === 'string' ? req.body.slotStart.trim() : '';
  const slotEnd = typeof req.body?.slotEnd === 'string' ? req.body.slotEnd.trim() : '';
  if (!token || !slotStart || !slotEnd) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'token and slot range are required',
      },
    });
    return;
  }

  const tokenOk = await verifyActionToken(bookingId, 'reschedule', token);
  if (!tokenOk) {
    res.status(403).json({
      error: {
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message:
          'This reschedule link is invalid or expired. Please call the shop.',
      },
    });
    return;
  }

  const booking = await getBookingById(bookingId);
  if (!booking) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return;
  }

  if (TERMINAL_BOOKING_STATUSES.has(normalizeStatus(booking.status))) {
    res.status(409).json({
      error: {
        code: 'BOOKING_NOT_RESCHEDULABLE',
        message: 'Booking cannot be rescheduled in its current state',
      },
    });
    return;
  }

  try {
    await run('BEGIN IMMEDIATE');

    const tokenConsumed = await consumeActionToken(bookingId, 'reschedule');
    if (!tokenConsumed) {
      await run('ROLLBACK').catch(() => undefined);
      res.status(403).json({
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'This reschedule link is invalid or expired. Please call the shop.',
        },
      });
      return;
    }

    await assertRescheduleSlot(booking, slotStart, slotEnd);
    await run('UPDATE bookings SET slot_start = ?, slot_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      slotStart,
      slotEnd,
      bookingId,
    ]);
    await updateBookingStatus(bookingId, 'confirmed');
    await logBookingEvent(bookingId, 'booking_rescheduled', {
      from: booking.slotStart,
      to: slotStart,
    });
    await run('COMMIT');

    res
      .status(200)
      .json({ data: { id: bookingId, status: 'confirmed', slotStart, slotEnd } });
  } catch (error) {
    await run('ROLLBACK').catch(() => {
      // Best-effort rollback; preserve failure response.
    });

    if (error instanceof Error) {
      if (error.message === 'INVALID_SLOT_RANGE') {
        res.status(400).json({
          error: { code: 'INVALID_SLOT_RANGE', message: 'slotStart/slotEnd are invalid' },
        });
        return;
      }
      if (error.message === 'INVALID_SLOT_DURATION') {
        res.status(400).json({
          error: {
            code: 'INVALID_SLOT_DURATION',
            message: 'slotEnd must match selected service duration',
          },
        });
        return;
      }
      if (error.message === 'INVALID_BOOKING_SERVICE') {
        res.status(409).json({
          error: {
            code: 'INVALID_BOOKING_SERVICE',
            message: 'Booking service is no longer available',
          },
        });
        return;
      }
      if (error.message === 'SLOT_UNAVAILABLE') {
        res.status(409).json({
          error: {
            code: 'SLOT_UNAVAILABLE',
            message: 'Requested slot overlaps an existing booking',
          },
        });
        return;
      }
    }

    throw error;
  }
};

export default handler;
