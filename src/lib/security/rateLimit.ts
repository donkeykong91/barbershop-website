import crypto from 'crypto';

import { queryOne, run } from '../db/sqlite';

type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, RateLimitEntry>();

const nowMs = () => Date.now();

const prune = () => {
  const now = nowMs();
  windows.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      windows.delete(key);
    }
  });
};

const fallbackCheckRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult => {
  prune();

  const now = nowMs();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      retryAfterSec: Math.ceil(windowMs / 1000),
      remaining: Math.max(0, maxRequests - 1),
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
      remaining: 0,
    };
  }

  existing.count += 1;
  windows.set(key, existing);

  return {
    allowed: true,
    retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    remaining: Math.max(0, maxRequests - existing.count),
  };
};

const ensureRateLimitTable = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS rate_limit_windows (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const checkRateLimit = async (
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> => {
  try {
    await ensureRateLimitTable();

    const now = nowMs();
    const existing = await queryOne<{ count: number; reset_at: number }>(
      `SELECT count, reset_at FROM rate_limit_windows WHERE key = ? LIMIT 1`,
      [key],
    );

    if (!existing || existing.reset_at <= now) {
      const resetAt = now + windowMs;
      await run(
        `
          INSERT INTO rate_limit_windows (id, key, count, reset_at)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET
            count = excluded.count,
            reset_at = excluded.reset_at
        `,
        [crypto.randomUUID(), key, resetAt],
      );

      return {
        allowed: true,
        retryAfterSec: Math.ceil(windowMs / 1000),
        remaining: Math.max(0, maxRequests - 1),
      };
    }

    if (existing.count >= maxRequests) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((existing.reset_at - now) / 1000),
        remaining: 0,
      };
    }

    const nextCount = existing.count + 1;
    await run('UPDATE rate_limit_windows SET count = ? WHERE key = ?', [
      nextCount,
      key,
    ]);

    return {
      allowed: true,
      retryAfterSec: Math.ceil((existing.reset_at - now) / 1000),
      remaining: Math.max(0, maxRequests - nextCount),
    };
  } catch {
    return fallbackCheckRateLimit(key, maxRequests, windowMs);
  }
};

export { checkRateLimit };
