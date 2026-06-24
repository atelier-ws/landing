-- Store the plaintext email alongside the hash so the manage-page
-- API can query LICENSE_DB (which stores email in the clear).
ALTER TABLE license_manage_tokens ADD COLUMN email TEXT NOT NULL DEFAULT '';
