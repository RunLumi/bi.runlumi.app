-- Server-owned deployment registration: the unit of Access identity, resource
-- ownership and control interface versioning. Shared cells register one scope row
-- (customer_id NULL, multi-tenant); dedicated customer deployments register one
-- row per customer/environment. Control verifies every forwarded end-user JWT
-- against the registered access_team/access_aud, never a shared global audience.
-- The claimed deployment id only locates this bounded policy; it confers nothing.
CREATE TABLE deployments (
  deployment_id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES tenants(id),
  environment TEXT CHECK(environment IN ('production','staging','preview')),
  hostname TEXT NOT NULL,
  access_team TEXT NOT NULL,
  access_aud TEXT NOT NULL,
  control_api_version INTEGER NOT NULL CHECK(control_api_version>0),
  resource_inventory TEXT NOT NULL CHECK(json_valid(resource_inventory)),
  state TEXT NOT NULL CHECK(state IN ('registered','suspended','retired')),
  updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX deployments_customer_environment ON deployments(customer_id,environment);
CREATE INDEX deployments_state ON deployments(state,deployment_id);