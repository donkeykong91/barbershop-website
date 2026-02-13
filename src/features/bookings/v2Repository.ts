import crypto from 'crypto';

import { queryAll, queryOne, run } from '../../lib/db/sqlite';

const HOLD_MINUTES = Number.parseInt(process.env.BOOKING_HOLD_MINUTES ?? '5', 10);
const RESCHEDULE_TOKEN_TTL_MIN = Number.parseInt(process.env.BOOKING_RESCHEDULE_TOKEN_TTL_MIN ?? '10080', 10);
const CANCEL_TOKEN_TTL_MIN = Number.parseInt(process.env.BOOKING_CANCEL_TOKEN_TTL_MIN ?? '10080', 10);

type BookingHold = {
  id: string;
  serviceId: string;
  staffId: string;
  slotStart: string;
  slotEnd: string;
  customerFingerprint: string;
  expiresAt: string;
};

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const cleanupExpiredHolds = async () => {
  await run('DELETE FROM booking_holds WHERE expires_at <= ?', [new Date().toISOString()]);
};

const createHold = async (input: {
  serviceId: string;
  staffId: string;
  slotStart: string;
  slotEnd: string;
  customerFingerprint: string;
}) => {
  await cleanupExpiredHolds();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Math.max(1, HOLD_MINUTES) * 60_000).toISOString();
  await run(
    `INSERT INTO booking_holds (id, service_id, staff_id, slot_start, slot_end, customer_fingerprint, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.serviceId, input.staffId, input.slotStart, input.slotEnd, input.customerFingerprint, expiresAt],
  );

  return { id, expiresAt };
};

const getValidHold = async (holdId: string, customerFingerprint: string): Promise<BookingHold | null> => {
  await cleanupExpiredHolds();
  const row = await queryOne<any>(
    `SELECT id, service_id, staff_id, slot_start, slot_end, customer_fingerprint, expires_at
     FROM booking_holds
     WHERE id = ? AND customer_fingerprint = ? AND expires_at > ?
     LIMIT 1`,
    [holdId, customerFingerprint, new Date().toISOString()],
  );

  if (!row) return null;
  return {
    id: row.id,
    serviceId: row.service_id,
    staffId: row.staff_id,
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
    customerFingerprint: row.customer_fingerprint,
    expiresAt: row.expires_at,
  };
};

const releaseHold = async (holdId: string) => {
  await run('DELETE FROM booking_holds WHERE id = ?', [holdId]);
};

const refreshHold = async (holdId: string, customerFingerprint: string) => {
  const expiresAt = new Date(Date.now() + Math.max(1, HOLD_MINUTES) * 60_000).toISOString();
  await run(
    `UPDATE booking_holds
     SET expires_at = ?
     WHERE id = ? AND customer_fingerprint = ? AND expires_at > ?`,
    [expiresAt, holdId, customerFingerprint, new Date().toISOString()],
  );
  return { expiresAt };
};

const createActionToken = async (bookingId: string, actionType: 'reschedule' | 'cancel') => {
  const token = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomUUID();
  const ttl = actionType === 'reschedule' ? RESCHEDULE_TOKEN_TTL_MIN : CANCEL_TOKEN_TTL_MIN;
  const expiresAt = new Date(Date.now() + Math.max(10, ttl) * 60_000).toISOString();

  await run(
    `INSERT INTO booking_action_tokens (id, booking_id, action_type, token_hash, nonce, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(booking_id, action_type)
     DO UPDATE SET token_hash = excluded.token_hash, nonce = excluded.nonce, expires_at = excluded.expires_at, consumed_at = NULL`,
    [crypto.randomUUID(), bookingId, actionType, hashToken(token), nonce, expiresAt],
  );

  return { token, expiresAt };
};

const verifyActionToken = async (bookingId: string, actionType: 'reschedule' | 'cancel', token: string) => {
  const row = await queryOne<any>(
    `SELECT token_hash, expires_at, consumed_at FROM booking_action_tokens
     WHERE booking_id = ? AND action_type = ? LIMIT 1`,
    [bookingId, actionType],
  );

  if (!row || row.consumed_at) return false;
  if (new Date(row.expires_at).getTime() <= Date.now()) return false;
  return hashToken(token) === row.token_hash;
};

const consumeActionToken = async (bookingId: string, actionType: 'reschedule' | 'cancel') => {
  await run(
    'UPDATE booking_action_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE booking_id = ? AND action_type = ?',
    [bookingId, actionType],
  );
};

const logBookingEvent = async (bookingId: string, eventType: string, payload: Record<string, unknown> = {}) => {
  await run(
    `INSERT INTO booking_lifecycle_events (id, booking_id, event_type, payload_json)
     VALUES (?, ?, ?, ?)`,
    [crypto.randomUUID(), bookingId, eventType, JSON.stringify(payload)],
  );
};

const listReminderCandidates = async (fromIso: string, toIso: string) =>
  queryAll<any>(
    `SELECT b.id, b.slot_start, b.slot_end, b.status,
            c.first_name, c.last_name, c.email, c.phone,
            s.name AS service_name,
            st.display_name AS staff_name
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN services s ON s.id = b.service_id
     JOIN staff st ON st.id = b.staff_id
     WHERE b.status = 'confirmed'
       AND b.slot_start >= ? AND b.slot_start < ?`,
    [fromIso, toIso],
  );

export {
  cleanupExpiredHolds,
  consumeActionToken,
  createActionToken,
  createHold,
  getValidHold,
  listReminderCandidates,
  logBookingEvent,
  refreshHold,
  releaseHold,
  verifyActionToken,
};
