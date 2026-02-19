import crypto from 'crypto';

import type { NextApiRequest } from 'next';

const normalize = (value: string | string[] | undefined) => {
  if (!value) {
    return '';
  }

  return (Array.isArray(value) ? value[0] ?? '' : value).trim().toLowerCase();
};

const getClientFingerprint = (req: NextApiRequest) => {
  const raw = [
    normalize(req.headers['user-agent']),
    normalize(req.headers['accept-language']),
    normalize(req.headers['sec-ch-ua-platform']),
    normalize(req.headers['sec-ch-ua-mobile']),
  ].join('|');

  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
};

export { getClientFingerprint };
