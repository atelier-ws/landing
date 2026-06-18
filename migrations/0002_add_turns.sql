ALTER TABLE telemetry_rollups ADD COLUMN turns INTEGER NOT NULL DEFAULT 0 CHECK (turns >= 0 AND turns <= 10000);
