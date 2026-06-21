CREATE TABLE IF NOT EXISTS pro_licenses (
  id TEXT PRIMARY KEY,
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT,
  email_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro',
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  checkout_claim_expires_at INTEGER NOT NULL,
  email_sent_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pro_licenses_email_hash
  ON pro_licenses(email_hash);

CREATE INDEX IF NOT EXISTS idx_pro_licenses_subscription
  ON pro_licenses(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS license_recovery_requests (
  email_hash TEXT PRIMARY KEY,
  last_sent_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1
);
