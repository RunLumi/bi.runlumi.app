-- Customer-owned migrations. This ledger is separate from the immutable core ledger.
-- Rules:
--   * Number files 0001_..., 0002_... and keep them immutable once applied.
--   * Add owned tables and indexes only. Do not alter or drop core-owned schema.
--   * Declare the compatible core schema version in a comment header.
-- The core installation schema runs first; these run after it in the installation database.
-- Example (uncomment and edit for your first owned table):
-- CREATE TABLE customer_saved_views (
--   installation_record_id TEXT NOT NULL,
--   id TEXT NOT NULL,
--   definition TEXT NOT NULL,
--   revision INTEGER NOT NULL DEFAULT 1,
--   updated_at TEXT NOT NULL,
--   PRIMARY KEY (installation_record_id, id)
-- );

-- This starter migration creates a real placeholder table so the ledger and
-- the runner have a working statement to record on a fresh installation.
-- Replace or extend it with your own tables; keep the file immutable once it
-- has been applied to any real database.
CREATE TABLE IF NOT EXISTS customer_workspace_notes (
  id TEXT PRIMARY KEY,
  note TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
