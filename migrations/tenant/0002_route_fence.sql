-- A deployment/config rollback must not undo a tenant routing cutover.
ALTER TABLE tenant_identity ADD COLUMN route_epoch INTEGER NOT NULL DEFAULT 1 CHECK(route_epoch>0);
