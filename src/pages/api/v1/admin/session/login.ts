import type { NextApiRequest, NextApiResponse } from 'next';

import { createAdminSession } from '../../../../../../lib/security/adminAuth';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported' } });
    return;
  }

  const provided = req.body?.apiKey?.toString() ?? '';
  if (!provided || provided !== (process.env.ADMIN_API_KEY ?? '')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid admin credentials' } });
    return;
  }

  await createAdminSession(res);
  res.status(200).json({ data: { ok: true } });
};

export default handler;
