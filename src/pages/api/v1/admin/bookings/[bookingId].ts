import type { NextApiRequest, NextApiResponse } from 'next';

import {
  type BookingStatus,
  getBookingById,
  updateBookingStatus,
} from '../../../../../features/bookings/repository';
import { recordAdminAuditEvent } from '../../../../../lib/security/adminAudit';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  pending_payment: ['cancelled', 'confirmed'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  payment_failed: ['cancelled', 'confirmed'],
  no_show: [],
};

const VALID_STATUSES = new Set<BookingStatus>([
  'pending_payment',
  'confirmed',
  'completed',
  'cancelled',
  'payment_failed',
  'no_show',
]);

const normalizeIncomingStatus = (status: unknown): BookingStatus | null => {
  if (typeof status !== 'string') {
    return null;
  }

  const normalized = status.trim().toLowerCase();
  if (VALID_STATUSES.has(normalized as BookingStatus)) {
    return normalized as BookingStatus;
  }

  return null;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyAdminRateLimit(req, res, 'bookings:detail'))) {
    return;
  }

  if (!(await requireAdminApiKey(req, res))) {
    return;
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only PATCH is supported on this endpoint',
      },
    });
    return;
  }

  const bookingId =
    typeof req.query.bookingId === 'string' ? req.query.bookingId : '';

  const rawStatus = (req.body as { status?: unknown })?.status;
  const status = normalizeIncomingStatus(rawStatus);

  if (!bookingId || !status) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'bookingId and valid status are required',
      },
    });
    return;
  }

  try {
    const booking = await getBookingById(bookingId);
    if (!booking) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Booking was not found',
        },
      });
      return;
    }

    if (!ALLOWED[booking.status].includes(status)) {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: `Cannot transition booking from ${booking.status} to ${status}`,
        },
      });
      return;
    }

    await updateBookingStatus(bookingId, status);

    const updated = { ...booking, status };

    await recordAdminAuditEvent({
      req,
      action: 'booking.status.update',
      resourceType: 'booking',
      resourceId: bookingId,
      before: booking,
      after: updated,
    });

    res.status(200).json({ data: updated });
  } catch {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to update booking at this time',
      },
    });
  }
};

export default handler;
