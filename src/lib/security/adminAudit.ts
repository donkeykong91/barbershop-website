import crypto from 'crypto';
import type { NextApiRequest } from 'next';

import { run } from '../db/sqlite';
import { getClientIp } from './clientIp';

type AuditInput = {
  req: NextApiRequest;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
};

const fingerprintAdminKey = (raw: string) =>
  crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);

const recordAdminAuditEvent = async ({
  req,
  action,
  resourceType,
  resourceId,
  before,
  after,
}: AuditInput) => {
  try {
    const provided = req.headers['x-admin-key'];
    const value = Array.isArray(provided) ? provided[0] : provided;
    const actor = value ? `key:${fingerprintAdminKey(value)}` : 'key:unknown';
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : '';

    await run(
      `
      INSERT INTO admin_audit_events (
        id,
        actor_key_fingerprint,
        action,
        resource_type,
        resource_id,
        before_json,
        after_json,
        ip,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        crypto.randomUUID(),
        actor,
        action,
        resourceType,
        resourceId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        getClientIp(req),
        userAgent,
      ],
    );
  } catch {
    // Best effort audit logging - must not break admin operation.
  }
};

export { recordAdminAuditEvent };
