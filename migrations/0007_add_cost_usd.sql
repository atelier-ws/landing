-- Add cost_usd column to track actual session cost (est_cost_usd from stop hook).
-- cost_usd is the model-billed cost of the session, stored alongside saved_usd
-- and carry_usd so the public-metrics endpoint can expose it independently.

ALTER TABLE telemetry_rollups ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0 CHECK (cost_usd >= 0);
