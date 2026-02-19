import type { NextApiRequest, NextApiResponse } from 'next';

import {
  createBlackout,
  deleteBlackout,
  hasBookingOverlap,
  listBlackoutsInRange,
} from '../../../../../features/availability/blackoutRepository';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await requireAdminApiKey(req, res))) return;

  if (req.method === 'GET') {
    const from =
      typeof req.query.from === 'string'
        ? req.query.from
        : new Date().toISOString();
    const to =
      typeof req.query.to === 'string'
        ? req.query.to
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await listBlackoutsInRange(from, to);
    res.status(200).json({ data: rows });
    return;
  }

  if (req.method === 'POST') {
    const { scope, staffId, startsAt, endsAt, reason } = req.body ?? {};
    if (!scope || !startsAt || !endsAt) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing blackout fields',
        },
      });
      return;
    }

    const overlap = await hasBookingOverlap({
      scope,
      staffId,
      startsAt,
      endsAt,
      reason,
    });
    if (overlap) {
      res.status(409).json({
        error: {
          code: 'BOOKING_OVERLAP',
          message: 'Blackout overlaps existing confirmed bookings',
        },
      });
      return;
    }

    const created = await createBlackout({
      scope,
      staffId,
      startsAt,
      endsAt,
      reason,
      createdBy: 'admin',
    });
    res.status(201).json({ data: created });
    return;
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'id is required' },
      });
      return;
    }
    await deleteBlackout(id);
    res.status(204).end();
    return;
  }

  res.setHeader('Allow', 'GET,POST,DELETE');
  res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported method' },
  });
};

export default handler;
