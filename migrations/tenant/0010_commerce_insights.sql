CREATE TABLE commerce_insights (
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 id TEXT NOT NULL,
 title TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 owner_subject TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('DRAFT','SAVED')),
 definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id)
) STRICT;
CREATE TABLE commerce_insight_runs (
 tenant_id TEXT NOT NULL,
 insight_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 publication_id TEXT NOT NULL,
 publication_hash TEXT NOT NULL,
 period_from TEXT NOT NULL,
 period_to_exclusive TEXT NOT NULL,
 query_json TEXT NOT NULL CHECK(json_valid(query_json)),
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 created_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,insight_id,run_id),
 UNIQUE(tenant_id,insight_id,revision),
 FOREIGN KEY(tenant_id,insight_id) REFERENCES commerce_insights(tenant_id,id),
 FOREIGN KEY(tenant_id,publication_id) REFERENCES commerce_publications(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_insights_immutable_identity BEFORE UPDATE OF tenant_id,id,owner_subject,created_at ON commerce_insights
BEGIN SELECT RAISE(ABORT,'INSIGHT_IDENTITY_IMMUTABLE'); END;
CREATE INDEX commerce_insights_recent ON commerce_insights(tenant_id,updated_at,id);
CREATE INDEX commerce_insight_runs_recent ON commerce_insight_runs(tenant_id,insight_id,revision DESC);
