/* eslint-disable simple-import-sort/imports */
import crypto from 'crypto';

import type { NextApiRequest, NextApiResponse } from 'next';

import { queryOne, run } from '../db/sqlite';
import { getClientIp } from './clientIp';
import { checkRateLimit } from './rateLimit';

const IDLE_MIN = Number.parseInt(
  process.env.ADMIN_SESSION_IDLE_MIN ?? '30',
  10,
);
const ABS_MIN = Number.parseInt(
  process.env.ADMIN_SESSION_ABSOLUTE_MIN ?? '480',
  10,
);

const getConfiguredAdminKey = () => {
  const configured = process.env.ADMIN_API_KEY?.trim() ?? '';
  if (!configured || configured === 'change-me') return '';
  return configured;
};

const hash = (value: string) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const timingSafeStringEqual = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

const parseCookie = (req: NextApiRequest, key: string) => {
  const cookie = req.headers.cookie ?? '';
  return cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${key}=`))
    ?.slice(key.length + 1);
};

const createAdminSession = async (res: NextApiResponse) => {
  const sessionSecret = crypto.randomBytes(32).toString('base64url');
  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = new Date(now + IDLE_MIN * 60_000).toISOString();
  const absoluteExpiresAt = new Date(now + ABS_MIN * 60_000).toISOString();

  await run(
    `INSERT INTO admin_sessions (id, session_secret_hash, expires_at, absolute_expires_at)
     VALUES (?, ?, ?, ?)`,
    [id, hash(sessionSecret), expiresAt, absoluteExpiresAt],
  );

  res.setHeader(
    'Set-Cookie',
    `kb_admin_session=${sessionSecret}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${IDLE_MIN * 60}`,
  );
};

const clearAdminSession = async (req: NextApiRequest, res: NextApiResponse) => {
  const sessionSecret = parseCookie(req, 'kb_admin_session');
  if (sessionSecret) {
    await run(
      'UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE session_secret_hash = ?',
      [hash(sessionSecret)],
    );
  }
  res.setHeader(
    'Set-Cookie',
    'kb_admin_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0',
  );
};

const requireAdminApiKey = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<boolean> => {
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(`admin:auth:${clientIp}`, 20, 60_000);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message:
          'Too many admin authentication attempts. Please try again shortly.',
      },
    });
    return false;
  }

  const sessionSecret = parseCookie(req, 'kb_admin_session');
  if (sessionSecret) {
    const row = await queryOne<any>(
      `SELECT id, expires_at, absolute_expires_at, revoked_at FROM admin_sessions WHERE session_secret_hash = ? LIMIT 1`,
      [hash(sessionSecret)],
    );
    if (
      row &&
      !row.revoked_at &&
      new Date(row.expires_at).getTime() > Date.now() &&
      new Date(row.absolute_expires_at).getTime() > Date.now()
    ) {
      await run(
        'UPDATE admin_sessions SET last_seen_at = CURRENT_TIMESTAMP, expires_at = ? WHERE id = ?',
        [new Date(Date.now() + IDLE_MIN * 60_000).toISOString(), row.id],
      );
      return true;
    }
  }

  const configured = getConfiguredAdminKey();
  if (!configured) {
    res.status(503).json({
      error: {
        code: 'ADMIN_NOT_CONFIGURED',
        message: 'Admin API key is not configured',
      },
    });
    return false;
  }

  const provided = req.headers['x-admin-key'];
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (!value || !timingSafeStringEqual(value, configured)) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid admin session or x-admin-key header is required',
      },
    });
    return false;
  }

  return true;
};

export { clearAdminSession, createAdminSession, requireAdminApiKey };
