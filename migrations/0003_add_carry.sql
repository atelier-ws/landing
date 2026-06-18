-- Add carry columns: cache re-reads avoided across turns.
-- Display layer sums saved_usd+carry_usd and tokens_saved+carry_tokens.
ALTER TABLE telemetry_rollups ADD COLUMN carry_usd REAL NOT NULL DEFAULT 0 CHECK (carry_usd >= 0 AND carry_usd <= 10000);
ALTER TABLE telemetry_rollups ADD COLUMN carry_tokens INTEGER NOT NULL DEFAULT 0 CHECK (carry_tokens >= 0 AND carry_tokens <= 1000000000);
