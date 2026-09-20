CREATE TABLE commerce_decisions (
 tenant_id TEXT NOT NULL REFERENCES tenant_identity(tenant_id),
 id TEXT NOT NULL,
 publication_id TEXT NOT NULL,
 finding_id TEXT NOT NULL,
 finding_json TEXT NOT NULL CHECK(json_valid(finding_json)),
 detector_version TEXT NOT NULL,
 owner_subject TEXT NOT NULL,
 rationale TEXT NOT NULL,
 due_on TEXT,
 state TEXT NOT NULL CHECK(state IN ('OPEN','INVESTIGATING','AWAITING_OUTCOME','RESOLVED','ACCEPTED_LIMITATION')),
 revision INTEGER NOT NULL CHECK(revision>0),
 outcome_publication_id TEXT,
 outcome_note TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,finding_id),
 FOREIGN KEY(tenant_id,publication_id) REFERENCES commerce_publications(tenant_id,id),
 FOREIGN KEY(tenant_id,outcome_publication_id) REFERENCES commerce_publications(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_decision_baseline_immutable
BEFORE UPDATE OF tenant_id,id,publication_id,finding_id,finding_json,detector_version,owner_subject,rationale,created_at ON commerce_decisions
BEGIN SELECT RAISE(ABORT,'DECISION_BASELINE_IMMUTABLE'); END;
CREATE TRIGGER commerce_decision_revision_required BEFORE UPDATE ON commerce_decisions WHEN NEW.revision!=OLD.revision+1
BEGIN SELECT RAISE(ABORT,'DECISION_REVISION_REQUIRED'); END;
CREATE INDEX commerce_decisions_recent ON commerce_decisions(tenant_id,updated_at,id);

CREATE TABLE commerce_decision_events (
 tenant_id TEXT NOT NULL,
 decision_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 from_state TEXT,
 to_state TEXT NOT NULL,
 actor_subject TEXT NOT NULL,
 note TEXT NOT NULL,
 evidence_publication_id TEXT,
 occurred_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,decision_id,revision),
 FOREIGN KEY(tenant_id,decision_id) REFERENCES commerce_decisions(tenant_id,id),
 FOREIGN KEY(tenant_id,evidence_publication_id) REFERENCES commerce_publications(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_decision_event_immutable BEFORE UPDATE ON commerce_decision_events
BEGIN SELECT RAISE(ABORT,'DECISION_EVENT_IMMUTABLE'); END;

CREATE TABLE commerce_source_events (
 tenant_id TEXT NOT NULL,
 connection_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 state TEXT NOT NULL,
 actor_subject TEXT NOT NULL,
 reason TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,connection_id,revision),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES commerce_connections(tenant_id,id)
) STRICT;
CREATE TRIGGER commerce_source_event_immutable BEFORE UPDATE ON commerce_source_events
BEGIN SELECT RAISE(ABORT,'SOURCE_EVENT_IMMUTABLE'); END;
