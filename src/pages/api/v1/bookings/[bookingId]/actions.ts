import type { NextApiRequest, NextApiResponse } from 'next';

import { createActionToken } from '../../../../../features/bookings/v2Repository';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported method' } });
    return;
  }

  const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId : '';
  const actionType = req.body?.actionType as 'reschedule' | 'cancel';
  if (!bookingId || (actionType !== 'reschedule' && actionType !== 'cancel')) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'bookingId and actionType are required' } });
    return;
  }

  const tokenData = await createActionToken(bookingId, actionType);
  res.status(200).json({ data: tokenData });
};

export default handler;
