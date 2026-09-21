CREATE TABLE local_memberships (
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('viewer','editor','owner')),
 state TEXT NOT NULL CHECK(state IN ('active','revoked')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,issuer,subject)
) STRICT;
CREATE TABLE local_entitlements (
 tenant_id TEXT PRIMARY KEY REFERENCES tenant_identity(tenant_id),
 state TEXT NOT NULL CHECK(state IN ('active','suspended')),
 features TEXT NOT NULL CHECK(json_valid(features)),
 revision INTEGER NOT NULL CHECK(revision>0),
 updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE local_authority_audit (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 actor_issuer TEXT NOT NULL,
 actor_subject TEXT NOT NULL,
 event_type TEXT NOT NULL,
 resource_id TEXT NOT NULL,
 occurred_at TEXT NOT NULL
) STRICT;
CREATE INDEX local_memberships_principal ON local_memberships(issuer,subject,state);
