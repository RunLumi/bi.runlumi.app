-- Installation schema additions: local credentials and commerce evidence support.
-- One database belongs to one installation; these tables are local application data.
PRAGMA foreign_keys = ON;

-- Direct sign-in credentials. Only issuer='local' users authenticate by password.
CREATE TABLE user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

-- Immutable link from a publication to the normalizations that produced it.
CREATE TABLE commerce_publication_inputs (
  publication_id TEXT NOT NULL REFERENCES commerce_publications(id),
  normalization_id TEXT NOT NULL REFERENCES commerce_normalizations(id),
  PRIMARY KEY (publication_id, normalization_id)
) STRICT;
CREATE TRIGGER commerce_publication_input_immutable BEFORE UPDATE ON commerce_publication_inputs
BEGIN SELECT RAISE(ABORT,'PUBLICATION_INPUT_IMMUTABLE'); END;

-- Reviewed source authorization history.
CREATE TABLE commerce_source_events (
  connection_id TEXT NOT NULL REFERENCES commerce_connections(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  state TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (connection_id, revision)
) STRICT;
CREATE TRIGGER commerce_source_event_immutable BEFORE UPDATE ON commerce_source_events
BEGIN SELECT RAISE(ABORT,'SOURCE_EVENT_IMMUTABLE'); END;

-- Owner-reviewed connector capability observations (metadata, never business rows).
CREATE TABLE commerce_capabilities (
  connection_id TEXT NOT NULL REFERENCES commerce_connections(id),
  capability_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('UNKNOWN','SUPPORTED','MISSING_SCOPE','UNSUPPORTED','BLOCKED_APPROVAL','DEGRADED')),
  evidence_ref TEXT NOT NULL,
  tested_at TEXT NOT NULL,
  coverage_json TEXT NOT NULL CHECK (json_valid(coverage_json)),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor TEXT NOT NULL,
  PRIMARY KEY (connection_id, capability_id)
) STRICT;

-- Decision register history: every state change of a reviewed decision.
CREATE TABLE commerce_decision_events (
  decision_id TEXT NOT NULL REFERENCES commerce_decisions(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT NOT NULL,
  evidence_publication_id TEXT REFERENCES commerce_publications(id),
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (decision_id, revision)
) STRICT;
CREATE TRIGGER commerce_decision_event_immutable BEFORE UPDATE ON commerce_decision_events
BEGIN SELECT RAISE(ABORT,'DECISION_EVENT_IMMUTABLE'); END;

-- Saved, publication-backed insight reports with reproducible runs.
CREATE TABLE commerce_insights (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  state TEXT NOT NULL CHECK (state IN ('DRAFT','SAVED')),
  definition_json TEXT NOT NULL CHECK (json_valid(definition_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX commerce_insights_recent ON commerce_insights(updated_at, id);

CREATE TABLE commerce_insight_runs (
  insight_id TEXT NOT NULL REFERENCES commerce_insights(id),
  run_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  publication_id TEXT NOT NULL REFERENCES commerce_publications(id),
  publication_hash TEXT NOT NULL,
  period_from TEXT NOT NULL,
  period_to_exclusive TEXT NOT NULL,
  query_json TEXT NOT NULL CHECK (json_valid(query_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (insight_id, run_id),
  UNIQUE (insight_id, revision)
) STRICT;
CREATE INDEX commerce_insight_runs_recent ON commerce_insight_runs(insight_id, revision DESC);

-- Retained evidence identity is immutable: raw receipts cannot be rewritten.
CREATE TRIGGER commerce_receipt_evidence_immutable
BEFORE UPDATE OF id,connection_id,delivery_id,fingerprint,content_hash,object_key,envelope_json,received_at ON commerce_receipts
BEGIN SELECT RAISE(ABORT,'RECEIPT_EVIDENCE_IMMUTABLE'); END;

CREATE TRIGGER commerce_mapping_immutable BEFORE UPDATE ON commerce_mappings
BEGIN SELECT RAISE(ABORT,'MAPPING_IMMUTABLE'); END;

CREATE TRIGGER commerce_publication_immutable BEFORE UPDATE ON commerce_publications
BEGIN SELECT RAISE(ABORT,'PUBLICATION_IMMUTABLE'); END;

-- Connection identity (provider/account/resource scope) cannot drift after authorization.
CREATE TRIGGER commerce_connection_identity_immutable
BEFORE UPDATE OF id,provider,source_account_id,resource_type,transport ON commerce_connections
BEGIN SELECT RAISE(ABORT,'CONNECTION_IDENTITY_IMMUTABLE'); END;
