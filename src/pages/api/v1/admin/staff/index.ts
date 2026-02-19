import type { NextApiRequest, NextApiResponse } from 'next';

import {
  createStaff,
  listStaff,
} from '../../../../../features/staff/repository';
import { recordAdminAuditEvent } from '../../../../../lib/security/adminAudit';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyAdminRateLimit(req, res, 'staff:index'))) {
    return;
  }

  if (!(await requireAdminApiKey(req, res))) {
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ data: await listStaff({ includeInactive: true }) });
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = req.body as {
        displayName?: string;
        email?: string;
        phone?: string;
        active?: boolean;
      };

      if (!body.displayName?.trim()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'displayName is required',
          },
        });
        return;
      }

      const created = await createStaff({
        displayName: body.displayName,
        active: body.active ?? true,
        ...(body.email ? { email: body.email } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
      });

      await recordAdminAuditEvent({
        req,
        action: 'staff.create',
        resourceType: 'staff',
        resourceId: created.id,
        after: created,
      });

      res.status(201).json({ data: created });
      return;
    } catch {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to create staff member at this time',
        },
      });
      return;
    }
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only GET and POST are supported on this endpoint',
    },
  });
};

export default handler;
