PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tenant_identity (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  tenant_id TEXT NOT NULL UNIQUE
) STRICT;
CREATE TABLE IF NOT EXISTS sources (
  tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('active','disabled')),
  PRIMARY KEY(tenant_id,id)
) STRICT;
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  observed_through TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  record_count INTEGER NOT NULL CHECK(record_count BETWEEN 1 AND 20),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,source_id,id),
  UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(tenant_id,source_id) REFERENCES sources(tenant_id,id)
) STRICT;
CREATE TABLE IF NOT EXISTS active_snapshots (
  tenant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  PRIMARY KEY(tenant_id,source_id),
  FOREIGN KEY(tenant_id,source_id,snapshot_id) REFERENCES snapshots(tenant_id,source_id,id)
) STRICT;
CREATE TABLE IF NOT EXISTS workflow_facts (
  tenant_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  business_day TEXT NOT NULL,
  workflow TEXT NOT NULL,
  cases INTEGER NOT NULL CHECK(cases >= 0),
  baseline_minutes INTEGER NOT NULL CHECK(baseline_minutes >= 0),
  human_minutes INTEGER NOT NULL CHECK(human_minutes >= 0),
  runtime_cost_vnd INTEGER NOT NULL CHECK(runtime_cost_vnd >= 0),
  support_cost_vnd INTEGER NOT NULL CHECK(support_cost_vnd >= 0),
  cash_savings_vnd INTEGER NOT NULL CHECK(cash_savings_vnd >= 0),
  cash_evidence_ref TEXT,
  PRIMARY KEY(tenant_id,snapshot_id,record_id),
  FOREIGN KEY(tenant_id,snapshot_id) REFERENCES snapshots(tenant_id,id),
  CHECK(cash_savings_vnd=0 OR cash_evidence_ref IS NOT NULL)
) STRICT;
CREATE INDEX IF NOT EXISTS facts_by_snapshot_day ON workflow_facts(tenant_id,snapshot_id,business_day);
CREATE TABLE IF NOT EXISTS dashboards (
  tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
  id TEXT NOT NULL,
  definition TEXT NOT NULL CHECK(json_valid(definition)),
  revision INTEGER NOT NULL CHECK(revision>0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tenant_id,id)
) STRICT;
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
  actor TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL
) STRICT;

-- A later publish must not move the source watermark backwards, including races.
CREATE TRIGGER IF NOT EXISTS prevent_watermark_regression
BEFORE UPDATE OF snapshot_id ON active_snapshots
WHEN (SELECT observed_through FROM snapshots WHERE id=NEW.snapshot_id AND tenant_id=NEW.tenant_id)
   < (SELECT observed_through FROM snapshots WHERE id=OLD.snapshot_id AND tenant_id=OLD.tenant_id)
BEGIN
  SELECT RAISE(ABORT, 'STALE_SNAPSHOT');
END;
-- The fixture contract has one aggregate row per workflow and business day per snapshot.
CREATE UNIQUE INDEX IF NOT EXISTS facts_grain ON workflow_facts(tenant_id,snapshot_id,business_day,workflow);
-- Enforce the dashboard quota inside the write transaction, not just in the request precheck.
CREATE TRIGGER IF NOT EXISTS enforce_dashboard_quota
BEFORE INSERT ON dashboards
WHEN (SELECT COUNT(*) FROM dashboards WHERE tenant_id=NEW.tenant_id)>=50
BEGIN
  SELECT RAISE(ABORT, 'DASHBOARD_QUOTA');
END;
