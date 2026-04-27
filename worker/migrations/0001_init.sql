-- Users & sessions
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  salt_b64 TEXT NOT NULL,
  hash_b64 TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Domains
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  label TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  check_interval_min INTEGER NOT NULL DEFAULT 60,
  next_check_at INTEGER NOT NULL,
  last_checked_at INTEGER,
  last_status TEXT,         -- registered|available|unknown|rate_limited|error
  last_rdap_http INTEGER,
  last_error TEXT,
  consecutive_errors INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER        -- Domain expiration date (Unix timestamp)
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER,
  type TEXT NOT NULL,       -- info|available|registered|rate_limited|error|auth
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

-- Key-value settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_next_check ON domains(next_check_at);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
