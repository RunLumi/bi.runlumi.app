-- C02/C06: owner-authorized exports only. No live vendor credentials or certification.
CREATE TABLE commerce_connections (
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 id TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('nhanh','haravan','shopee','generic')),
 source_account_id TEXT NOT NULL,
 resource_type TEXT NOT NULL CHECK(resource_type IN ('orders','settlements','inventory')),
 transport TEXT NOT NULL CHECK(transport='authorized-export'),
 approval_ref TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','paused','revoked')),
 revision INTEGER NOT NULL CHECK(revision>0),
 PRIMARY KEY(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_connection_identity_immutable
BEFORE UPDATE OF tenant_id,id,provider,source_account_id,resource_type,transport ON commerce_connections
BEGIN SELECT RAISE(ABORT,'CONNECTION_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER commerce_connection_revision_required
BEFORE UPDATE ON commerce_connections WHEN NEW.revision<=OLD.revision
BEGIN SELECT RAISE(ABORT,'CONNECTION_REVISION_REQUIRED'); END;
CREATE TABLE commerce_receipts (
 tenant_id TEXT NOT NULL,
 id TEXT NOT NULL,
 connection_id TEXT NOT NULL,
 delivery_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 object_key TEXT NOT NULL,
 envelope_json TEXT NOT NULL CHECK(json_valid(envelope_json)),
 state TEXT NOT NULL CHECK(state IN ('ACCEPTED','NORMALIZING','NORMALIZED','RECONCILING','PUBLISHED','RETRY_PENDING','QUARANTINED','DEAD_LETTERED','REVOKED')),
 received_at TEXT NOT NULL,
 route_epoch INTEGER NOT NULL,
 connection_revision INTEGER NOT NULL,
 normalized_revision TEXT,
 published_version TEXT,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,connection_id,delivery_id),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES commerce_connections(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_receipt_evidence_immutable
BEFORE UPDATE OF tenant_id,id,connection_id,delivery_id,fingerprint,content_hash,object_key,envelope_json,received_at,route_epoch,connection_revision ON commerce_receipts
BEGIN SELECT RAISE(ABORT,'RECEIPT_EVIDENCE_IMMUTABLE'); END;
CREATE TABLE commerce_outbox (
 tenant_id TEXT NOT NULL,
 receipt_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('PENDING','DISPATCHED')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 created_at TEXT NOT NULL,
 dispatched_at TEXT,
 PRIMARY KEY(tenant_id,receipt_id),
 FOREIGN KEY(tenant_id,receipt_id) REFERENCES commerce_receipts(tenant_id,id)
) STRICT;
CREATE INDEX commerce_outbox_pending ON commerce_outbox(tenant_id,state,created_at,receipt_id);
CREATE INDEX commerce_receipts_recent ON commerce_receipts(tenant_id,received_at,id);
