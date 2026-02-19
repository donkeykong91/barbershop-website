import type { NextApiRequest, NextApiResponse } from 'next';

import {
  createHold,
  refreshHold,
  releaseHold,
} from '../../../../features/bookings/v2Repository';
import { getClientFingerprint } from '../../../../lib/security/clientFingerprint';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const fingerprint = getClientFingerprint(req);

  if (req.method === 'POST') {
    const { serviceId, staffId, slotStart, slotEnd } = req.body ?? {};
    if (!serviceId || !staffId || !slotStart || !slotEnd) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing hold fields' },
      });
      return;
    }

    try {
      const hold = await createHold({
        serviceId,
        staffId,
        slotStart,
        slotEnd,
        customerFingerprint: fingerprint,
      });
      res.status(201).json({ data: hold });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === 'INVALID_SLOT_START_FORMAT' ||
          error.message === 'INVALID_SLOT_END_FORMAT' ||
          error.message === 'INVALID_SLOT_RANGE' ||
          error.message === 'INVALID_SERVICE' ||
          error.message === 'INVALID_STAFF'
        ) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message:
                error.message === 'INVALID_SLOT_START_FORMAT'
                  ? 'slotStart must be ISO-8601 datetime with timezone'
                  : error.message === 'INVALID_SLOT_END_FORMAT'
                    ? 'slotEnd must be ISO-8601 datetime with timezone'
                    : error.message === 'INVALID_SLOT_RANGE'
                      ? 'slotStart must be before slotEnd'
                      : error.message === 'INVALID_SERVICE'
                        ? 'serviceId is invalid or not available'
                        : 'staffId is invalid or inactive',
            },
          });
          return;
        }

        if (error.message === 'HOLD_RATE_LIMIT_EXCEEDED') {
          res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many active holds for this fingerprint. Please try again later.',
            },
          });
          return;
        }
      }

      throw error;
    }
    return;
  }

  if (req.method === 'PATCH') {
    const { holdId } = req.body ?? {};
    if (!holdId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'holdId is required' },
      });
      return;
    }
    const data = await refreshHold(holdId, fingerprint);
    if (!data) {
      res.status(404).json({
        error: {
          code: 'HOLD_NOT_FOUND',
          message: 'Hold not found or already expired',
        },
      });
      return;
    }
    res.status(200).json({ data });
    return;
  }

  if (req.method === 'DELETE') {
    const holdId = typeof req.query.holdId === 'string' ? req.query.holdId : '';
    if (!holdId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'holdId is required' },
      });
      return;
    }
    const result = await releaseHold(holdId);
    if (!result?.deleted) {
      res.status(404).json({
        error: { code: 'HOLD_NOT_FOUND', message: 'Hold not found or already expired' },
      });
      return;
    }
    res.status(204).end();
    return;
  }

  res.setHeader('Allow', 'POST,PATCH,DELETE');
  res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported method' },
  });
};

export default handler;
