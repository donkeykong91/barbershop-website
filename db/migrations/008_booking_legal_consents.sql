CREATE TABLE IF NOT EXISTS booking_legal_consents (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  legal_version TEXT NOT NULL,
  agreed_to_terms INTEGER NOT NULL DEFAULT 0,
  agreed_to_privacy INTEGER NOT NULL DEFAULT 0,
  agreed_to_booking_policies INTEGER NOT NULL DEFAULT 0,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  sms_opt_in INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  agreed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booking_legal_consents_booking_id
  ON booking_legal_consents(booking_id);
