CREATE TABLE IF NOT EXISTS license_checkout_deliveries (
  session_id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);
