-- Additive migration: route fencing and tenant-owned AI configuration references.
ALTER TABLE tenants ADD COLUMN route_epoch INTEGER NOT NULL DEFAULT 1 CHECK(route_epoch>0);
CREATE TABLE tenant_ai_profiles (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider_instance_ref TEXT NOT NULL,
  model_ref TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('active','revoked')),
  PRIMARY KEY(tenant_id,provider_instance_ref,model_ref,credential_ref)
) STRICT;
-- Values are logical references, never secrets. Grants are provisioned by trusted operators.
