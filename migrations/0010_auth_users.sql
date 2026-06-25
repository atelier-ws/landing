CREATE TABLE IF NOT EXISTS auth_users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  github_id TEXT,
  google_id TEXT,
  stripe_customer TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_github ON auth_users(github_id) WHERE github_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_google ON auth_users(google_id) WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
ALTER TABLE auth_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'web';
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_kind ON auth_sessions(user_id, kind);

CREATE TABLE IF NOT EXISTS auth_oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  device_name TEXT,
  cli_redirect TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_email_logins (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  cli_redirect TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_auth_email_logins_email ON auth_email_logins(email);
