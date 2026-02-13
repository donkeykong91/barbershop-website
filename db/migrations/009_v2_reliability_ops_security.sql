CREATE TABLE IF NOT EXISTS booking_holds (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  slot_start TEXT NOT NULL,
  slot_end TEXT NOT NULL,
  customer_fingerprint TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_holds_lookup
  ON booking_holds(staff_id, slot_start, slot_end, expires_at);

CREATE TABLE IF NOT EXISTS booking_lifecycle_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_booking
  ON booking_lifecycle_events(booking_id, created_at);

CREATE TABLE IF NOT EXISTS booking_action_tokens (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('reschedule','cancel')),
  token_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_id, action_type),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booking_action_tokens_expiry
  ON booking_action_tokens(action_type, expires_at);

CREATE TABLE IF NOT EXISTS blackout_windows (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('shop','staff')),
  staff_id TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blackout_windows_scope_time
  ON blackout_windows(scope, staff_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  session_secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry
  ON admin_sessions(expires_at, absolute_expires_at, revoked_at);
