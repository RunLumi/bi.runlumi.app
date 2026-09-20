-- C06/C07: immutable typed revisions. No publication or production source certification.
CREATE TABLE commerce_normalizations (
 tenant_id TEXT NOT NULL,
 id TEXT NOT NULL,
 receipt_id TEXT NOT NULL,
 normalizer_version TEXT NOT NULL,
 raw_content_hash TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('NORMALIZED','QUARANTINED')),
 reason_code TEXT,
 payload_json TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),
 record_count INTEGER NOT NULL CHECK(record_count BETWEEN 0 AND 100),
 created_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,receipt_id,normalizer_version),
 FOREIGN KEY(tenant_id,receipt_id) REFERENCES commerce_receipts(tenant_id,id),
 CHECK((state='NORMALIZED' AND payload_json IS NOT NULL AND reason_code IS NULL)
    OR (state='QUARANTINED' AND payload_json IS NULL AND reason_code IS NOT NULL))
) STRICT;
CREATE TRIGGER commerce_normalization_immutable BEFORE UPDATE ON commerce_normalizations
BEGIN SELECT RAISE(ABORT,'NORMALIZATION_IMMUTABLE'); END;
CREATE INDEX commerce_normalizations_recent ON commerce_normalizations(tenant_id,created_at,id);
