import crypto from 'crypto';

import { queryAll, queryOne, run } from '../../lib/db/sqlite';
import { AppConfig } from '../../utils/AppConfig';
import { getServiceById } from '../services/repository';

type CreateBookingInput = {
  serviceId: string;
  staffId: string;
  slotStart: string;
  slotEnd: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  notes?: string;
};

type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'
  | 'no_show';

type LogBookingLegalConsentInput = {
  bookingId: string;
  legalVersion: string;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
  agreedToBookingPolicies: boolean;
  marketingOptIn: boolean;
  smsOptIn: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type BookingRecord = {
  id: string;
  status: BookingStatus;
  totalCents: number;
  currency: 'USD';
  serviceId: string;
  staffId: string;
  slotStart: string;
  slotEnd: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
};

type CreatedBookingRecord = BookingRecord & {
  accessToken: string;
};

type BookingRow = {
  id: string;
  status: string;
  total_cents: number;
  currency: 'USD';
  service_id: string;
  staff_id: string;
  slot_start: string;
  slot_end: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

type BookingAccessTokenRow = {
  token_hash: string;
};

type BookingListFilters = {
  from?: string;
  to?: string;
  status?: BookingStatus;
  staffId?: string;
  limit?: number;
  cursor?: string;
  includeCustomer?: boolean;
};

const STATUS_FILTER_VARIANTS: Record<BookingStatus, string[]> = {
  pending_payment: ['pending_payment', 'PENDING_PAYMENT'],
  confirmed: ['confirmed', 'CONFIRMED', 'BOOKED'],
  completed: ['completed', 'COMPLETED'],
  cancelled: ['cancelled', 'CANCELLED'],
  payment_failed: ['payment_failed', 'PAYMENT_FAILED'],
  no_show: ['no_show', 'NO_SHOW'],
};

type ConfirmationMessage = {
  bookingId: string;
  channels: Array<{
    channel: 'email' | 'sms';
    status: 'queued' | 'sent' | 'failed';
  }>;
  summary: {
    amountPaidCents: number;
    remainingBalanceCents: number;
    paymentPolicy: 'cash_at_shop';
  };
};

const LEGACY_STATUS_MAP: Record<string, BookingStatus> = {
  BOOKED: 'confirmed',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
  PENDING_PAYMENT: 'pending_payment',
  PAYMENT_FAILED: 'payment_failed',
};

const normalizeBookingStatus = (status: string): BookingStatus => {
  const upper = status.trim().toUpperCase();
  const mappedLegacyStatus = LEGACY_STATUS_MAP[upper];
  if (mappedLegacyStatus) {
    return mappedLegacyStatus;
  }

  const lower = status.trim().toLowerCase();
  if (
    lower === 'confirmed' ||
    lower === 'completed' ||
    lower === 'no_show' ||
    lower === 'cancelled' ||
    lower === 'pending_payment' ||
    lower === 'payment_failed'
  ) {
    return lower as BookingStatus;
  }

  return 'cancelled';
};

const BLOCKING_STATUSES = [
  'confirmed',
  'completed',
  'no_show',
  'BOOKED',
  'COMPLETED',
  'NO_SHOW',
];
const CANCELLABLE_STATUSES: BookingStatus[] = ['confirmed', 'pending_payment'];
const SHA256_HEX_LENGTH = 64;
const DUMMY_BOOKING_TOKEN_HASH = '0'.repeat(SHA256_HEX_LENGTH);

type SchemaColumnRow = {
  name: string;
};

const ensureTableColumns = async (
  tableName: string,
  requiredColumns: Array<{ name: string; sql: string }>,
): Promise<void> => {
  const rows = await queryAll<SchemaColumnRow>(
    `PRAGMA table_info(${tableName})`,
  );
  const existingColumns = new Set(rows.map((row) => row.name));

  const missingColumns = requiredColumns.filter(
    (column) => !existingColumns.has(column.name),
  );

  await missingColumns.reduce(
    (promise, column) =>
      promise.then(async () => {
        await run(column.sql);
      }),
    Promise.resolve(),
  );
};

const ensureBookingNotificationsSchema = async (): Promise<void> => {
  await run(
    `
    CREATE TABLE IF NOT EXISTS booking_notifications (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
      status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
    `,
  );

  await ensureTableColumns('booking_notifications', [
    {
      name: 'status',
      sql: "ALTER TABLE booking_notifications ADD COLUMN status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed'))",
    },
    {
      name: 'payload',
      sql: "ALTER TABLE booking_notifications ADD COLUMN payload TEXT NOT NULL DEFAULT '{}'",
    },
    {
      name: 'created_at',
      sql: 'ALTER TABLE booking_notifications ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
  ]);

  await run(
    `
    CREATE INDEX IF NOT EXISTS idx_booking_notifications_booking
    ON booking_notifications(booking_id)
    `,
  );

  await run(
    `
    CREATE INDEX IF NOT EXISTS idx_booking_notifications_status
    ON booking_notifications(status)
    `,
  );
};

const ensureBookingAccessTokensSchema = async (): Promise<void> => {
  await run(
    `
    CREATE TABLE IF NOT EXISTS booking_access_tokens (
      booking_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
    `,
  );

  await ensureTableColumns('booking_access_tokens', [
    {
      name: 'token_hash',
      sql: "ALTER TABLE booking_access_tokens ADD COLUMN token_hash TEXT NOT NULL DEFAULT ''",
    },
    {
      name: 'created_at',
      sql: 'ALTER TABLE booking_access_tokens ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    {
      name: 'updated_at',
      sql: 'ALTER TABLE booking_access_tokens ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
  ]);

  await run(
    `
    CREATE INDEX IF NOT EXISTS idx_booking_access_tokens_created_at
    ON booking_access_tokens(created_at)
    `,
  );
};

const ensureBookingWriteSchemas = async (): Promise<void> => {
  await ensureBookingNotificationsSchema();
  await ensureBookingAccessTokensSchema();
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const hashBookingAccessToken = (token: string) =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const generateBookingAccessToken = () =>
  crypto.randomBytes(32).toString('base64url');

const secureHashEquals = (
  expectedHashHex: string,
  candidateHashHex: string,
) => {
  const expected = Buffer.from(expectedHashHex, 'hex');
  const candidate = Buffer.from(candidateHashHex, 'hex');

  if (expected.length !== candidate.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, candidate);
};

const mapRowToRecord = (row: BookingRow): BookingRecord => {
  const customer =
    row.first_name && row.last_name && row.email && row.phone
      ? {
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
        }
      : null;

  return {
    id: row.id,
    status: normalizeBookingStatus(row.status),
    totalCents: row.total_cents,
    currency: row.currency,
    serviceId: row.service_id,
    staffId: row.staff_id,
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
    ...(customer ? { customer } : {}),
  };
};

const findOrCreateCustomer = async (
  customer: CreateBookingInput['customer'],
): Promise<string> => {
  const existing = await queryOne<{ id: string }>(
    `
      SELECT id
      FROM customers
      WHERE email = ? AND phone = ?
      LIMIT 1
      `,
    [normalizeEmail(customer.email), customer.phone.trim()],
  );

  if (existing) {
    return existing.id;
  }

  const customerId = crypto.randomUUID();

  await run(
    `
    INSERT INTO customers (
      id,
      first_name,
      last_name,
      email,
      phone
    ) VALUES (?, ?, ?, ?, ?)
    `,
    [
      customerId,
      customer.firstName.trim(),
      customer.lastName.trim(),
      normalizeEmail(customer.email),
      customer.phone.trim(),
    ],
  );

  return customerId;
};

const hasSlotConflict = async (
  staffId: string,
  slotStart: string,
  slotEnd: string,
): Promise<boolean> => {
  const row = await queryOne<{ found: number }>(
    `
      SELECT 1 AS found
      FROM bookings
      WHERE staff_id = ?
        AND status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})
        AND slot_end > ?
        AND slot_start < ?
      LIMIT 1
      `,
    [staffId, ...BLOCKING_STATUSES, slotStart, slotEnd],
  );

  return Boolean(row);
};

const hasSlotConflictExcludingBooking = async (
  bookingId: string,
  staffId: string,
  slotStart: string,
  slotEnd: string,
): Promise<boolean> => {
  const row = await queryOne<{ found: number }>(
    `
      SELECT 1 AS found
      FROM bookings
      WHERE staff_id = ?
        AND id <> ?
        AND status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})
        AND slot_end > ?
        AND slot_start < ?
      LIMIT 1
      `,
    [staffId, bookingId, ...BLOCKING_STATUSES, slotStart, slotEnd],
  );

  return Boolean(row);
};

const assertRescheduleSlot = async (
  booking: BookingRecord,
  slotStart: string,
  slotEnd: string,
): Promise<void> => {
  const start = new Date(slotStart);
  const end = new Date(slotEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('INVALID_SLOT_RANGE');
  }

  if (!(start < end)) {
    throw new Error('INVALID_SLOT_RANGE');
  }

  const service = await getServiceById(booking.serviceId);
  if (!service || !service.active || !service.bookable || !service.visible) {
    throw new Error('INVALID_BOOKING_SERVICE');
  }

  const expectedEnd = new Date(start.getTime() + service.durationMin * 60_000);
  if (expectedEnd.getTime() !== end.getTime()) {
    throw new Error('INVALID_SLOT_DURATION');
  }

  const conflicted = await hasSlotConflictExcludingBooking(
    booking.id,
    booking.staffId,
    slotStart,
    slotEnd,
  );

  if (conflicted) {
    throw new Error('SLOT_UNAVAILABLE');
  }
};

const queueConfirmationNotifications = async (bookingId: string) => {
  const emailPayload = JSON.stringify({
    template: 'booking_confirmed_cash_only',
    bookingId,
  });
  const smsPayload = JSON.stringify({
    template: 'booking_confirmed_cash_only',
    bookingId,
  });

  await run(
    `
    INSERT INTO booking_notifications (id, booking_id, channel, status, payload)
    VALUES (?, ?, 'email', 'queued', ?), (?, ?, 'sms', 'queued', ?)
    `,
    [
      crypto.randomUUID(),
      bookingId,
      emailPayload,
      crypto.randomUUID(),
      bookingId,
      smsPayload,
    ],
  );
};

const createBookingAccessToken = async (bookingId: string): Promise<string> => {
  const accessToken = generateBookingAccessToken();
  const tokenHash = hashBookingAccessToken(accessToken);

  await run(
    `
    INSERT INTO booking_access_tokens (
      booking_id,
      token_hash
    ) VALUES (?, ?)
    `,
    [bookingId, tokenHash],
  );

  return accessToken;
};

const createBooking = async (
  input: CreateBookingInput,
): Promise<CreatedBookingRecord> => {
  const service = await getServiceById(input.serviceId);

  if (!service || !service.active || !service.bookable || !service.visible) {
    throw new Error('SERVICE_NOT_BOOKABLE');
  }

  await ensureBookingWriteSchemas();
  await run('BEGIN IMMEDIATE');

  try {
    if (await hasSlotConflict(input.staffId, input.slotStart, input.slotEnd)) {
      await run('ROLLBACK');
      throw new Error('SLOT_UNAVAILABLE');
    }

    const customerId = await findOrCreateCustomer(input.customer);
    const bookingId = crypto.randomUUID();

    await run(
      `
      INSERT INTO bookings (
        id,
        customer_id,
        service_id,
        staff_id,
        slot_start,
        slot_end,
        status,
        total_cents,
        currency,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
      `,
      [
        bookingId,
        customerId,
        input.serviceId,
        input.staffId,
        input.slotStart,
        input.slotEnd,
        service.priceCents,
        service.currency,
        input.notes?.trim() ?? null,
      ],
    );

    const accessToken = await createBookingAccessToken(bookingId);
    await run('COMMIT');

    try {
      await queueConfirmationNotifications(bookingId);
    } catch (notificationError) {
      console.warn('[booking] notification queue persistence failed', {
        bookingId,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }

    return {
      id: bookingId,
      status: 'confirmed',
      totalCents: service.priceCents,
      currency: service.currency,
      serviceId: input.serviceId,
      staffId: input.staffId,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
      accessToken,
    } as CreatedBookingRecord;
  } catch (error) {
    await run('ROLLBACK').catch(() => {
      // Best-effort rollback; lock release is required for request progress.
    });

    throw error;
  }
};

const bookingLegalConsentInsertSql = `
      INSERT INTO booking_legal_consents (
        id,
        booking_id,
        legal_version,
        agreed_to_terms,
        agreed_to_privacy,
        agreed_to_booking_policies,
        marketing_opt_in,
        sms_opt_in,
        ip_address,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

const buildBookingLegalConsentInsertArgs = (
  input: LogBookingLegalConsentInput,
) => [
  crypto.randomUUID(),
  input.bookingId,
  input.legalVersion,
  input.agreedToTerms ? 1 : 0,
  input.agreedToPrivacy ? 1 : 0,
  input.agreedToBookingPolicies ? 1 : 0,
  input.marketingOptIn ? 1 : 0,
  input.smsOptIn ? 1 : 0,
  input.ipAddress ?? null,
  input.userAgent ?? null,
];

const ensureBookingLegalConsentsSchema = async (): Promise<void> => {
  await run(
    `
      CREATE TABLE IF NOT EXISTS booking_legal_consents (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        legal_version TEXT NOT NULL,
        agreed_to_terms INTEGER NOT NULL CHECK (agreed_to_terms IN (0, 1)),
        agreed_to_privacy INTEGER NOT NULL CHECK (agreed_to_privacy IN (0, 1)),
        agreed_to_booking_policies INTEGER NOT NULL CHECK (agreed_to_booking_policies IN (0, 1)),
        marketing_opt_in INTEGER NOT NULL CHECK (marketing_opt_in IN (0, 1)),
        sms_opt_in INTEGER NOT NULL CHECK (sms_opt_in IN (0, 1)),
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
      `,
  );

  await run(
    `
      CREATE INDEX IF NOT EXISTS idx_booking_legal_consents_booking_id
      ON booking_legal_consents(booking_id)
      `,
  );
};

const isMissingBookingLegalConsentsTableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /no such table:\s*(?:\w+\.)?booking_legal_consents/i.test(
    error.message,
  );
};

const isMissingBookingLegalConsentsColumnError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /table\s+(?:\w+\.)?booking_legal_consents\s+has\s+no\s+column\s+named/i.test(
    error.message,
  );
};

type TableInfoRow = {
  name: string;
};

const ensureBookingLegalConsentsColumns = async (): Promise<void> => {
  const rows = await queryAll<TableInfoRow>(
    'PRAGMA table_info(booking_legal_consents)',
  );
  const existingColumns = new Set(rows.map((row) => row.name));

  const requiredColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'agreed_to_booking_policies',
      sql: 'ALTER TABLE booking_legal_consents ADD COLUMN agreed_to_booking_policies INTEGER NOT NULL DEFAULT 0 CHECK (agreed_to_booking_policies IN (0, 1))',
    },
    {
      name: 'marketing_opt_in',
      sql: 'ALTER TABLE booking_legal_consents ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0, 1))',
    },
    {
      name: 'sms_opt_in',
      sql: 'ALTER TABLE booking_legal_consents ADD COLUMN sms_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (sms_opt_in IN (0, 1))',
    },
    {
      name: 'ip_address',
      sql: 'ALTER TABLE booking_legal_consents ADD COLUMN ip_address TEXT',
    },
    {
      name: 'user_agent',
      sql: 'ALTER TABLE booking_legal_consents ADD COLUMN user_agent TEXT',
    },
  ];

  const missingColumnStatements = requiredColumns
    .filter((column) => !existingColumns.has(column.name))
    .map((column) => run(column.sql));

  await Promise.all(missingColumnStatements);
};

const logBookingLegalConsent = async (
  input: LogBookingLegalConsentInput,
): Promise<void> => {
  try {
    await run(
      bookingLegalConsentInsertSql,
      buildBookingLegalConsentInsertArgs(input),
    );
  } catch (error) {
    if (isMissingBookingLegalConsentsTableError(error)) {
      await ensureBookingLegalConsentsSchema();
    } else if (isMissingBookingLegalConsentsColumnError(error)) {
      await ensureBookingLegalConsentsColumns();
    } else {
      throw error;
    }

    await run(
      bookingLegalConsentInsertSql,
      buildBookingLegalConsentInsertArgs(input),
    );
  }
};

const getBookingById = async (
  bookingId: string,
): Promise<BookingRecord | null> => {
  const row = await queryOne<BookingRow>(
    `
      SELECT
        b.id,
        b.status,
        b.total_cents,
        b.currency,
        b.service_id,
        b.staff_id,
        b.slot_start,
        b.slot_end,
        c.first_name,
        c.last_name,
        c.email,
        c.phone
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      WHERE b.id = ?
      LIMIT 1
      `,
    [bookingId],
  );

  if (!row) {
    return null;
  }

  return mapRowToRecord(row);
};

const verifyBookingAccessToken = async (
  bookingId: string,
  accessToken: string,
): Promise<boolean> => {
  const token = accessToken.trim();

  if (!token) {
    return false;
  }

  const tokenHash = hashBookingAccessToken(token);

  const row = await queryOne<BookingAccessTokenRow>(
    `
      SELECT token_hash
      FROM booking_access_tokens
      WHERE booking_id = ?
      LIMIT 1
      `,
    [bookingId],
  );

  const expectedHash =
    row &&
    typeof row.token_hash === 'string' &&
    row.token_hash.length === SHA256_HEX_LENGTH
      ? row.token_hash
      : DUMMY_BOOKING_TOKEN_HASH;

  const matches = secureHashEquals(expectedHash, tokenHash);

  return Boolean(row) && matches;
};

const getBookingByIdWithAccessToken = async (
  bookingId: string,
  accessToken: string,
): Promise<BookingRecord | null> => {
  if (!(await verifyBookingAccessToken(bookingId, accessToken))) {
    throw new Error('BOOKING_ACCESS_DENIED');
  }

  return getBookingById(bookingId);
};

const listBookings = async (
  filters: BookingListFilters,
): Promise<BookingRecord[]> => {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters.from) {
    clauses.push('b.slot_start >= ?');
    params.push(filters.from);
  }

  if (filters.to) {
    clauses.push('b.slot_start <= ?');
    params.push(filters.to);
  }

  if (filters.status) {
    const statusVariants = STATUS_FILTER_VARIANTS[filters.status] ?? [
      filters.status,
    ];
    clauses.push(`b.status IN (${statusVariants.map(() => '?').join(',')})`);
    params.push(...statusVariants);
  }

  if (filters.staffId) {
    clauses.push('b.staff_id = ?');
    params.push(filters.staffId);
  }

  if (filters.cursor) {
    const [cursorSlotStart, cursorId] = filters.cursor.split('|');
    if (cursorSlotStart && cursorId) {
      clauses.push('(b.slot_start < ? OR (b.slot_start = ? AND b.id < ?))');
      params.push(cursorSlotStart, cursorSlotStart, cursorId);
    }
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const includeCustomer = filters.includeCustomer === true;
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

  const rows = await queryAll<BookingRow>(
    `
      SELECT
        b.id,
        b.status,
        b.total_cents,
        b.currency,
        b.service_id,
        b.staff_id,
        b.slot_start,
        b.slot_end,
        ${
          includeCustomer
            ? 'c.first_name, c.last_name, c.email, c.phone'
            : 'NULL AS first_name, NULL AS last_name, NULL AS email, NULL AS phone'
        }
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      ${whereSql}
      ORDER BY b.slot_start DESC, b.id DESC
      LIMIT ?
      `,
    [...params, limit],
  );

  return rows.map(mapRowToRecord);
};

const cancelBooking = async (bookingId: string): Promise<BookingRecord> => {
  const existing = await getBookingById(bookingId);

  if (!existing) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    throw new Error('BOOKING_NOT_CANCELLABLE');
  }

  const slotStart = new Date(existing.slotStart).getTime();
  const now = Date.now();
  const cutoffMs = AppConfig.cancellationCutoffHours * 60 * 60 * 1000;

  if (slotStart - now < cutoffMs) {
    throw new Error('CANCELLATION_CUTOFF_REACHED');
  }

  await run(
    `
      UPDATE bookings
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
    [bookingId],
  );

  return {
    ...existing,
    status: 'cancelled' as BookingStatus,
  };
};

const updateBookingStatus = async (
  bookingId: string,
  status: BookingStatus,
): Promise<void> => {
  await run(
    'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, bookingId],
  );
};

const getBookingConfirmation = async (
  bookingId: string,
): Promise<ConfirmationMessage> => {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  const channels = await queryAll<ConfirmationMessage['channels'][number]>(
    `
      SELECT channel, status
      FROM booking_notifications
      WHERE booking_id = ?
      ORDER BY created_at ASC
      `,
    [bookingId],
  );

  return {
    bookingId,
    channels,
    summary: {
      amountPaidCents: 0,
      remainingBalanceCents: booking.totalCents,
      paymentPolicy: 'cash_at_shop',
    },
  };
};

export {
  assertRescheduleSlot,
  cancelBooking,
  createBooking,
  getBookingById,
  getBookingByIdWithAccessToken,
  getBookingConfirmation,
  listBookings,
  logBookingLegalConsent,
  updateBookingStatus,
  verifyBookingAccessToken,
};
export type {
  BookingListFilters,
  BookingRecord,
  BookingStatus,
  ConfirmationMessage,
  CreateBookingInput,
  CreatedBookingRecord,
  LogBookingLegalConsentInput,
};
