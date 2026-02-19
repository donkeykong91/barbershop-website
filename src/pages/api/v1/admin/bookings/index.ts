import type { NextApiRequest, NextApiResponse } from 'next';

import {
  type BookingStatus,
  listBookings,
} from '../../../../../features/bookings/repository';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

const MAX_LIMIT = 100;

const normalizeStatusFilter = (value: unknown): BookingStatus | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const upper = value.trim().toUpperCase();
  if (upper === 'BOOKED' || upper === 'CONFIRMED') {
    return 'confirmed';
  }
  if (upper === 'COMPLETED') {
    return 'completed';
  }
  if (upper === 'CANCELLED') {
    return 'cancelled';
  }
  if (upper === 'NO_SHOW') {
    return 'no_show';
  }
  if (upper === 'PENDING_PAYMENT') {
    return 'pending_payment';
  }
  if (upper === 'PAYMENT_FAILED') {
    return 'payment_failed';
  }

  return undefined;
};

const parseLimit = (value: string | string[] | undefined): number => {
  if (typeof value !== 'string') {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 50;
  }

  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyAdminRateLimit(req, res, 'bookings:index'))) {
    return;
  }

  if (!(await requireAdminApiKey(req, res))) {
    return;
  }

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

  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const staffId =
    typeof req.query.staffId === 'string' ? req.query.staffId : undefined;
  const status = normalizeStatusFilter(req.query.status);
  const cursor =
    typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const includeCustomer = req.query.includeCustomer === 'true';
  const limit = parseLimit(req.query.limit);

  try {
    const filters = {
      limit: limit + 1,
      includeCustomer,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(status ? { status } : {}),
      ...(staffId ? { staffId } : {}),
      ...(cursor ? { cursor } : {}),
    };

    const rows = await listBookings(filters);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const nextCursor = hasMore && last ? `${last.slotStart}|${last.id}` : null;

    const data = page.map((booking) => ({
      ...booking,
      paymentState: 'pending_cash_collection',
    }));

    res.status(200).json({
      data,
      meta: {
        count: data.length,
        limit,
        nextCursor,
      },
    });
  } catch {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to list bookings at this time',
      },
    });
  }
};

export default handler;
