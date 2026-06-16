CREATE TABLE IF NOT EXISTS telemetry_rollups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL UNIQUE,
  install_key TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  atelier_version TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL DEFAULT 'atelier',
  saved_usd REAL NOT NULL DEFAULT 0,
  tokens_saved INTEGER NOT NULL DEFAULT 0,
  calls_avoided INTEGER NOT NULL DEFAULT 0,
  CHECK (saved_usd >= 0 AND saved_usd <= 1000),
  CHECK (tokens_saved >= 0 AND tokens_saved <= 100000000),
  CHECK (calls_avoided >= 0 AND calls_avoided <= 1000000)
);

CREATE INDEX IF NOT EXISTS telemetry_rollups_received_at
  ON telemetry_rollups(received_at);

CREATE INDEX IF NOT EXISTS telemetry_rollups_install_key
  ON telemetry_rollups(install_key);
