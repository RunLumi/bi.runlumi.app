-- Lumi BI installation schema.
-- One database belongs to one installation; requests never select another database.
PRAGMA foreign_keys = ON;

CREATE TABLE installation (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  name TEXT NOT NULL,
  initialized_at TEXT NOT NULL,
  core_release TEXT NOT NULL
) STRICT;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','editor','owner')),
  state TEXT NOT NULL CHECK (state IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (issuer, subject)
) STRICT;
CREATE INDEX users_principal ON users(issuer, subject, state);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
) STRICT;
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active','disabled'))
) STRICT;

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  observed_through TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  record_count INTEGER NOT NULL CHECK (record_count BETWEEN 1 AND 100)
) STRICT;
CREATE UNIQUE INDEX snapshots_source_id ON snapshots(source_id, id);

CREATE TABLE active_snapshots (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id)
) STRICT;

CREATE TABLE workflow_facts (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
  record_id TEXT NOT NULL,
  business_day TEXT NOT NULL,
  workflow TEXT NOT NULL,
  cases INTEGER NOT NULL CHECK (cases >= 0),
  baseline_minutes INTEGER NOT NULL CHECK (baseline_minutes >= 0),
  human_minutes INTEGER NOT NULL CHECK (human_minutes >= 0),
  runtime_cost_vnd INTEGER NOT NULL CHECK (runtime_cost_vnd >= 0),
  support_cost_vnd INTEGER NOT NULL CHECK (support_cost_vnd >= 0),
  cash_savings_vnd INTEGER NOT NULL CHECK (cash_savings_vnd >= 0),
  cash_evidence_ref TEXT,
  PRIMARY KEY (snapshot_id, record_id),
  CHECK (cash_savings_vnd = 0 OR cash_evidence_ref IS NOT NULL)
) STRICT;
CREATE UNIQUE INDEX facts_grain ON workflow_facts(snapshot_id, business_day, workflow);
CREATE INDEX facts_by_snapshot_day ON workflow_facts(snapshot_id, business_day);

CREATE TABLE dashboards (
  id TEXT PRIMARY KEY,
  definition TEXT NOT NULL CHECK (json_valid(definition)),
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL
) STRICT;

CREATE TABLE commerce_connections (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('nhanh','haravan','shopee','generic')),
  source_account_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('orders','settlements','inventory')),
  transport TEXT NOT NULL CHECK (transport = 'authorized-export'),
  approval_ref TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active','paused','revoked')),
  revision INTEGER NOT NULL CHECK (revision > 0)
) STRICT;

CREATE TABLE commerce_receipts (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES commerce_connections(id),
  delivery_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  envelope_json TEXT NOT NULL CHECK (json_valid(envelope_json)),
  state TEXT NOT NULL,
  received_at TEXT NOT NULL,
  connection_revision INTEGER NOT NULL,
  normalized_revision TEXT,
  published_version TEXT,
  UNIQUE (connection_id, delivery_id)
) STRICT;

CREATE TABLE commerce_normalizations (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES commerce_receipts(id),
  normalizer_version TEXT NOT NULL,
  raw_content_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('NORMALIZED','QUARANTINED')),
  reason_code TEXT,
  payload_json TEXT CHECK (payload_json IS NULL OR json_valid(payload_json)),
  record_count INTEGER NOT NULL CHECK (record_count BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  UNIQUE (receipt_id, normalizer_version)
) STRICT;

CREATE TABLE commerce_mappings (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL
) STRICT;

CREATE TABLE commerce_publications (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  report_json TEXT NOT NULL CHECK (json_valid(report_json)),
  mapping_id TEXT REFERENCES commerce_mappings(id),
  predecessor_id TEXT REFERENCES commerce_publications(id),
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL
) STRICT;

CREATE TABLE commerce_heads (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  active_publication_id TEXT REFERENCES commerce_publications(id),
  revision INTEGER NOT NULL CHECK (revision >= 0)
) STRICT;

CREATE TABLE commerce_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('NORMALIZE_RECEIPT')),
  receipt_id TEXT NOT NULL REFERENCES commerce_receipts(id),
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  lease_token TEXT,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (kind, receipt_id)
) STRICT;

CREATE TABLE commerce_decisions (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES commerce_publications(id),
  finding_id TEXT NOT NULL UNIQUE,
  finding_json TEXT NOT NULL CHECK (json_valid(finding_json)),
  detector_version TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  rationale TEXT NOT NULL,
  due_on TEXT,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  outcome_publication_id TEXT REFERENCES commerce_publications(id),
  outcome_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
