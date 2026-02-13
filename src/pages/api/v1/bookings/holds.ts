import type { NextApiRequest, NextApiResponse } from 'next';

import { createHold, refreshHold, releaseHold } from '../../../../features/bookings/v2Repository';
import { getClientFingerprint } from '../../../../lib/security/clientFingerprint';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const fingerprint = getClientFingerprint(req);

  if (req.method === 'POST') {
    const { serviceId, staffId, slotStart, slotEnd } = req.body ?? {};
    if (!serviceId || !staffId || !slotStart || !slotEnd) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing hold fields' } });
      return;
    }

    const hold = await createHold({ serviceId, staffId, slotStart, slotEnd, customerFingerprint: fingerprint });
    res.status(201).json({ data: hold });
    return;
  }

  if (req.method === 'PATCH') {
    const { holdId } = req.body ?? {};
    if (!holdId) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'holdId is required' } });
      return;
    }
    const data = await refreshHold(holdId, fingerprint);
    res.status(200).json({ data });
    return;
  }

  if (req.method === 'DELETE') {
    const holdId = typeof req.query.holdId === 'string' ? req.query.holdId : '';
    if (!holdId) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'holdId is required' } });
      return;
    }
    await releaseHold(holdId);
    res.status(204).end();
    return;
  }

  res.setHeader('Allow', 'POST,PATCH,DELETE');
  res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported method' } });
};

export default handler;
