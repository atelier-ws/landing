-- Token-based access to the license management page.
-- Generated during email recovery, expires after 7 days.
CREATE TABLE IF NOT EXISTS license_manage_tokens (
  token TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_manage_tokens_email ON license_manage_tokens(email_hash);
