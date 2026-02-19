import type { NextApiRequest, NextApiResponse } from 'next';

import {
  createService,
  listServices,
} from '../../../../../features/services/repository';
import { recordAdminAuditEvent } from '../../../../../lib/security/adminAudit';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyAdminRateLimit(req, res, 'services:index'))) {
    return;
  }

  if (!(await requireAdminApiKey(req, res))) {
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      data: await listServices({ includeInactive: true, includeHidden: true }),
    });
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = req.body as {
        name?: string;
        description?: string;
        durationMin?: number;
        priceCents?: number;
        active?: boolean;
        visible?: boolean;
        bookable?: boolean;
        displayOrder?: number;
      };

      if (
        !body.name ||
        !body.description ||
        !body.durationMin ||
        body.priceCents === undefined ||
        body.durationMin <= 0 ||
        body.priceCents < 0
      ) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message:
              'name, description, durationMin (>0) and priceCents (>=0) are required',
          },
        });
        return;
      }

      const created = await createService({
        name: body.name,
        description: body.description,
        durationMin: body.durationMin,
        priceCents: body.priceCents,
        active: body.active ?? true,
        visible: body.visible ?? true,
        bookable: body.bookable ?? true,
        ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
      });

      await recordAdminAuditEvent({
        req,
        action: 'service.create',
        resourceType: 'service',
        resourceId: created.id,
        after: created,
      });

      res.status(201).json({ data: created });
      return;
    } catch {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to create service at this time',
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
