import type { NextApiRequest, NextApiResponse } from 'next';

import { listServices } from '../../../features/services/repository';

const formatPrice = (priceCents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);

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

  const data = (await listServices()).map((service) => ({
    ...service,
    priceDisplay: formatPrice(service.priceCents, service.currency),
  }));

  res.status(200).json({ data });
};

export default handler;
