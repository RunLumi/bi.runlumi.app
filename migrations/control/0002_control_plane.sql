-- Additive migration. Apply centrally once; no automatic paid entitlement grants.
CREATE TABLE users (
  issuer TEXT NOT NULL, subject TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('active','disabled')),
  PRIMARY KEY(issuer,subject)
) STRICT;
INSERT INTO users SELECT DISTINCT issuer,subject,'active' FROM memberships;
CREATE TABLE platform_operators (
  issuer TEXT NOT NULL, subject TEXT NOT NULL,
  PRIMARY KEY(issuer,subject),
  FOREIGN KEY(issuer,subject) REFERENCES users(issuer,subject)
) STRICT;
CREATE TABLE licenses (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  plan_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('trial','active','past_due','suspended','cancelled')),
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, grace_ends_at TEXT,
  features TEXT NOT NULL CHECK(json_valid(features)),
  revision INTEGER NOT NULL CHECK(revision>0), updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE pack_sources (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  repository TEXT NOT NULL, source_path TEXT NOT NULL,
  UNIQUE(repository,source_path)
) STRICT;
CREATE TABLE tenant_releases (
  tenant_id TEXT NOT NULL REFERENCES tenants(id), release_id TEXT NOT NULL,
  content_hash TEXT NOT NULL, object_key TEXT NOT NULL,
  source_commit TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(tenant_id,release_id), UNIQUE(tenant_id,source_commit)
) STRICT;
CREATE TABLE tenant_deployments (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  active_release_id TEXT, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  FOREIGN KEY(tenant_id,active_release_id) REFERENCES tenant_releases(tenant_id,release_id)
) STRICT;
INSERT INTO tenant_deployments(tenant_id) SELECT id FROM tenants;
CREATE TRIGGER initialize_deployment AFTER INSERT ON tenants
BEGIN INSERT INTO tenant_deployments(tenant_id) VALUES (NEW.id); END;
CREATE TABLE control_audit (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  actor_issuer TEXT NOT NULL, actor_subject TEXT NOT NULL,
  event_type TEXT NOT NULL, resource_id TEXT NOT NULL,
  reason TEXT NOT NULL, occurred_at TEXT NOT NULL
) STRICT;
CREATE INDEX licenses_state ON licenses(state,ends_at);
CREATE INDEX control_audit_tenant ON control_audit(tenant_id,occurred_at);
