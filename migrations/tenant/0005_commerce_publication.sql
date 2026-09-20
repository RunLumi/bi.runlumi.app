-- C07/C08/C10: reviewed identity releases and immutable bounded publication manifests.
CREATE TABLE commerce_mappings (
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 id TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 created_at TEXT NOT NULL,
 actor TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_mapping_immutable BEFORE UPDATE ON commerce_mappings
BEGIN SELECT RAISE(ABORT,'MAPPING_IMMUTABLE'); END;
CREATE TABLE commerce_publications (
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 id TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 report_json TEXT NOT NULL CHECK(json_valid(report_json)),
 mapping_id TEXT,
 predecessor_id TEXT,
 created_at TEXT NOT NULL,
 actor TEXT NOT NULL,
 reason TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,mapping_id) REFERENCES commerce_mappings(tenant_id,id),
 FOREIGN KEY(tenant_id,predecessor_id) REFERENCES commerce_publications(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_publication_immutable BEFORE UPDATE ON commerce_publications
BEGIN SELECT RAISE(ABORT,'PUBLICATION_IMMUTABLE'); END;
CREATE TABLE commerce_publication_inputs (
 tenant_id TEXT NOT NULL,
 publication_id TEXT NOT NULL,
 normalization_id TEXT NOT NULL,
 PRIMARY KEY(tenant_id,publication_id,normalization_id),
 FOREIGN KEY(tenant_id,publication_id) REFERENCES commerce_publications(tenant_id,id),
 FOREIGN KEY(tenant_id,normalization_id) REFERENCES commerce_normalizations(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_publication_input_immutable BEFORE UPDATE ON commerce_publication_inputs
BEGIN SELECT RAISE(ABORT,'PUBLICATION_INPUT_IMMUTABLE'); END;
CREATE TABLE commerce_heads (
 tenant_id TEXT PRIMARY KEY REFERENCES tenant_identity(tenant_id),
 active_publication_id TEXT,
 revision INTEGER NOT NULL CHECK(revision>=0),
 FOREIGN KEY(tenant_id,active_publication_id) REFERENCES commerce_publications(tenant_id,id)
) STRICT;
CREATE INDEX commerce_publications_recent ON commerce_publications(tenant_id,created_at,id);
