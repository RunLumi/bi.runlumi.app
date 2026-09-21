-- Account hardening: durable login-throttle state and a schema migration ledger.
-- One database belongs to one installation; these are local application data.
PRAGMA foreign_keys = ON;

-- Bounded per-login failure budget. Generic failures are always returned to the
-- caller; this table only decides whether a login attempt is admitted at all.
CREATE TABLE login_throttle (
  login TEXT PRIMARY KEY,
  failures INTEGER NOT NULL CHECK (failures >= 0),
  window_until TEXT NOT NULL
) STRICT;

-- Checksummed migration ledger: applied migrations are immutable history.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;
CREATE TRIGGER IF NOT EXISTS schema_migrations_immutable_update BEFORE UPDATE ON schema_migrations
BEGIN SELECT RAISE(ABORT,'MIGRATION_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS schema_migrations_immutable_delete BEFORE DELETE ON schema_migrations
BEGIN SELECT RAISE(ABORT,'MIGRATION_HISTORY_IMMUTABLE'); END;
