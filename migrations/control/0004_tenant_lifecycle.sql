-- C01/C22: canonical lifecycle fence. Legacy tenants.state remains a coarse
-- deployment compatibility field; lifecycle_state controls interactive access.
CREATE TABLE tenant_lifecycle (
 tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
 state TEXT NOT NULL CHECK(state IN ('PROVISIONING','VALIDATING','ACTIVE','SUSPENDED','EXPORT_PENDING','DELETING','DELETED','FAILED')),
 revision INTEGER NOT NULL CHECK(revision>0),
 reason TEXT NOT NULL,
 updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX tenant_lifecycle_state ON tenant_lifecycle(state,tenant_id);
