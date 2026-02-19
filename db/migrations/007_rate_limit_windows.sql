CREATE TABLE IF NOT EXISTS rate_limit_windows (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_windows_key ON rate_limit_windows(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_windows_reset_at ON rate_limit_windows(reset_at);
