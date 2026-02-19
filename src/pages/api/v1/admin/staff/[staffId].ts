import type { NextApiRequest, NextApiResponse } from 'next';

import {
  listStaff,
  listStaffAvailability,
  replaceStaffAvailability,
  updateStaff,
} from '../../../../../features/staff/repository';
import { recordAdminAuditEvent } from '../../../../../lib/security/adminAudit';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyAdminRateLimit(req, res, 'staff:detail'))) {
    return;
  }

  if (!(await requireAdminApiKey(req, res))) {
    return;
  }

  const staffId =
    typeof req.query.staffId === 'string' ? req.query.staffId : '';
  if (!staffId) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'staffId is required',
      },
    });
    return;
  }

  try {
    if (req.method === 'PATCH') {
      const before =
        (await listStaff({ includeInactive: true })).find(
          (item) => item.id === staffId,
        ) ?? null;
      const updated = await updateStaff(
        staffId,
        req.body as {
          displayName?: string;
          email?: string;
          phone?: string;
          active?: boolean;
        },
      );

      if (!updated) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Staff member was not found',
          },
        });
        return;
      }

      await recordAdminAuditEvent({
        req,
        action: 'staff.update',
        resourceType: 'staff',
        resourceId: staffId,
        before,
        after: updated,
      });

      res.status(200).json({ data: updated });
      return;
    }

    if (req.method === 'GET') {
      res.status(200).json({ data: await listStaffAvailability(staffId) });
      return;
    }

    if (req.method === 'PUT') {
      const body = req.body as {
        entries?: Array<{
          dayOfWeek: number;
          startTimeLocal: string;
          endTimeLocal: string;
          timezone: string;
          isAvailable: boolean;
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

      const before = await listStaffAvailability(staffId);
      const data = await replaceStaffAvailability(staffId, body.entries);

      await recordAdminAuditEvent({
        req,
        action: 'staff.availability.replace',
        resourceType: 'staff',
        resourceId: staffId,
        before,
        after: data,
      });

      res.status(200).json({ data });
      return;
    }
  } catch {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to process staff request at this time',
      },
    });
    return;
  }

  res.setHeader('Allow', 'GET, PATCH, PUT');
  res.status(405).json({
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only GET, PATCH and PUT are supported on this endpoint',
    },
  });
};

export default handler;
