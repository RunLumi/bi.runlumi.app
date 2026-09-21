# Validation boundary

The installation test suite uses synthetic data and the local SQLite adapter. It
proves schema initialization, local users, role checks, source registration,
snapshot provenance, semantic queries, dashboard revisions, and disabled-user
behavior. It does not prove a live Cloudflare deployment, DNS, provider access,
or production backup durability.

Live deployment, Cloudflare account configuration, identity-provider setup, and
legal review remain separate evidence layers.
