import type { NextApiRequest, NextApiResponse } from 'next';

import { listStaff } from '../../../features/staff/repository';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET is supported on this endpoint',
      },
    });
    return;
  }

  const staff = await listStaff();
  res.status(200).json({
    data: [{ id: 'any', displayName: 'Any barber', active: true }, ...staff],
  });
};

export default handler;
