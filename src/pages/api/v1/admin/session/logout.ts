import type { NextApiRequest, NextApiResponse } from 'next';

import { clearAdminSession } from '../../../../../lib/security/adminAuth';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is supported',
      },
    });
    return;
  }

  await clearAdminSession(req, res);
  res.status(200).json({ data: { ok: true } });
};

export default handler;
