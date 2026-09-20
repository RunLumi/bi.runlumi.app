PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  binding_name TEXT NOT NULL UNIQUE,
  cell_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('active','suspended'))
) STRICT;
CREATE TABLE IF NOT EXISTS memberships (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('viewer','editor','owner')),
  state TEXT NOT NULL CHECK(state IN ('active','revoked')),
  PRIMARY KEY(tenant_id,issuer,subject)
) STRICT;
CREATE INDEX IF NOT EXISTS membership_lookup ON memberships(issuer,subject,state);
