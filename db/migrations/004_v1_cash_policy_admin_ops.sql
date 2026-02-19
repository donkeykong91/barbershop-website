CREATE TABLE IF NOT EXISTS business_hours (
  id TEXT PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time_local TEXT NOT NULL,
  close_time_local TEXT NOT NULL,
  timezone TEXT NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  UNIQUE(day_of_week)
);

CREATE TABLE IF NOT EXISTS booking_notifications (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booking_notifications_booking
  ON booking_notifications(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_notifications_status
  ON booking_notifications(status);
