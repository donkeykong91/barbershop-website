import type { NextApiRequest, NextApiResponse } from 'next';

import {
  listBusinessHours,
  replaceBusinessHours,
} from '../../../../../features/availability/businessHoursRepository';
import { recordAdminAuditEvent } from '../../../../../lib/security/adminAudit';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

const DAY_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyAdminRateLimit(req, res, 'business-hours:index'))) {
    return;
  }

  if (!(await requireAdminApiKey(req, res))) {
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ data: await listBusinessHours() });
    return;
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body as {
        entries?: Array<{
          dayOfWeek: number;
          openTimeLocal: string;
          closeTimeLocal: string;
          timezone: string;
          isOpen: boolean;
        }>;
      };

      if (!body.entries || !Array.isArray(body.entries)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'entries array is required',
          },
        });
        return;
      }

      const hasInvalidEntry = body.entries.some(
        (entry) =>
          !Number.isInteger(entry.dayOfWeek) ||
          entry.dayOfWeek < 0 ||
          entry.dayOfWeek > 6 ||
          !DAY_TIME_REGEX.test(entry.openTimeLocal) ||
          !DAY_TIME_REGEX.test(entry.closeTimeLocal) ||
          entry.openTimeLocal >= entry.closeTimeLocal ||
          !entry.timezone,
      );

      if (hasInvalidEntry) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message:
              'entries must include valid dayOfWeek, open/close times, timezone, and openTimeLocal < closeTimeLocal',
          },
        });
        return;
      }

      const before = await listBusinessHours();
      const data = await replaceBusinessHours(body.entries);

      await recordAdminAuditEvent({
        req,
        action: 'business_hours.replace',
        resourceType: 'business_hours',
        resourceId: 'default',
        before,
        after: data,
      });

      res.status(200).json({ data });
      return;
    } catch {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to update business hours at this time',
        },
      });
      return;
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  res.status(405).json({
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only GET and PUT are supported on this endpoint',
    },
  });
};

export default handler;
