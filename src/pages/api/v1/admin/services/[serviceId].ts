import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServiceById,
  updateService,
} from '../../../../../features/services/repository';
import { recordAdminAuditEvent } from '../../../../../lib/security/adminAudit';
import { requireAdminApiKey } from '../../../../../lib/security/adminAuth';
import { applyAdminRateLimit } from '../../../../../lib/security/adminRateLimit';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyAdminRateLimit(req, res, 'services:detail'))) {
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

  const serviceId =
    typeof req.query.serviceId === 'string' ? req.query.serviceId : '';

  if (!serviceId) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'serviceId is required',
      },
    });
    return;
  }

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
    (body.durationMin !== undefined &&
      (!Number.isInteger(body.durationMin) ||
        body.durationMin < 5 ||
        body.durationMin > 480)) ||
    (body.priceCents !== undefined &&
      (!Number.isInteger(body.priceCents) || body.priceCents < 0))
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'durationMin must be 5-480 and priceCents must be a non-negative integer',
      },
    });
    return;
  }

  try {
    const before = await getServiceById(serviceId);
    const updated = await updateService(serviceId, body);

    if (!updated) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Service was not found',
        },
      });
      return;
    }

    await recordAdminAuditEvent({
      req,
      action: 'service.update',
      resourceType: 'service',
      resourceId: serviceId,
      before,
      after: updated,
    });

    res.status(200).json({ data: updated });
  } catch {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to update service at this time',
      },
    });
  }
};

export default handler;
