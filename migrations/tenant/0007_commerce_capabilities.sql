-- C02/C08: reviewed source capability and coverage evidence.
CREATE TABLE commerce_capabilities (
 tenant_id TEXT NOT NULL,
 connection_id TEXT NOT NULL,
 capability_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('UNKNOWN','SUPPORTED','MISSING_SCOPE','UNSUPPORTED','BLOCKED_APPROVAL','DEGRADED')),
 evidence_ref TEXT NOT NULL,
 tested_at TEXT NOT NULL,
 coverage_json TEXT NOT NULL CHECK(json_valid(coverage_json)),
 revision INTEGER NOT NULL CHECK(revision>0),
 actor TEXT NOT NULL,
 PRIMARY KEY(tenant_id,connection_id,capability_id),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES commerce_connections(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_capability_revision_required BEFORE UPDATE ON commerce_capabilities WHEN NEW.revision<=OLD.revision
BEGIN SELECT RAISE(ABORT,'CAPABILITY_REVISION_REQUIRED'); END;
CREATE TRIGGER commerce_capability_identity_immutable BEFORE UPDATE OF tenant_id,connection_id,capability_id ON commerce_capabilities
BEGIN SELECT RAISE(ABORT,'CAPABILITY_IDENTITY_IMMUTABLE'); END;
