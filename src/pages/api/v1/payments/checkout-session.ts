import type { NextApiRequest, NextApiResponse } from 'next';

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is supported on this endpoint',
      },
    });
    return;
  }

  res.status(410).json({
    error: {
      code: 'PAYMENTS_DISABLED',
      message:
        'Online payments are disabled for v1. Payment is collected in-shop (cash only).',
    },
  });
};

export default handler;
