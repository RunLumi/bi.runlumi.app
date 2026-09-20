-- C06/C23: bounded durable job admission and lease state.
CREATE TABLE commerce_jobs (
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('NORMALIZE_RECEIPT')),
 receipt_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('PENDING','RUNNING','RETRY_PENDING','COMPLETED','DEAD_LETTERED','CANCELLED')),
 attempts INTEGER NOT NULL CHECK(attempts>=0),
 lease_token TEXT,
 lease_until TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,kind,receipt_id),
 FOREIGN KEY(tenant_id,receipt_id) REFERENCES commerce_receipts(tenant_id,id),
 CHECK((state='RUNNING' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (state!='RUNNING' AND lease_token IS NULL AND lease_until IS NULL))
) STRICT;
CREATE INDEX commerce_jobs_admission ON commerce_jobs(tenant_id,state,created_at,id);
CREATE TRIGGER commerce_job_immutable_identity BEFORE UPDATE OF tenant_id,id,kind,receipt_id,created_at ON commerce_jobs
BEGIN SELECT RAISE(ABORT,'JOB_IDENTITY_IMMUTABLE'); END;
