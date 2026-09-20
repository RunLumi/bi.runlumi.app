# 0006 — Central control service and truthful commerce foundation

Status: accepted implementation subset. Date: 2026-09-20.
Supersedes the per-cell authority choice in ADR 0001 and thin ES-module-only UI
choice in ADR 0005. Historical ADRs remain as decision history.

## Decision

Use one private control Worker + metadata D1 for global identities, memberships,
license entitlements, tenant routing and reviewed configuration pointers. Data-cell
Workers hold only their tenant serving bindings and source R2, with a CONTROL service
binding. Both Workers verify the presented Access JWT. The current deployment uses
a shared Access team/audience, not arbitrary federated identity.

Tenant identity plus route epoch is checked on admission. Configuration activation
compares revision and route epoch. Cell/tenant migration orchestration is a separate
feature; require suspension, drain, copy/reconcile and fenced cutover operationally.

Use React/Vite with the existing Lumi design system and wrapped Tabler icons.
UI state is keyed by identity, tenant, configuration and date window. The merchant
home reflects Money Truth, Stock Decisions and Operations Exceptions without
pretending those live datasets are available. Operations-cost remains a working,
explicitly bounded pack. Query all dashboard widgets under one known snapshot vector.

Git packs currently use trusted operator registration with **unverified source
attestation**. Do not substitute a commit string for provenance. Enabled AI refs
must belong to the target tenant, but there is no LLM execution path yet.

## Tradeoffs

Every admitted request consults primary control authority; no cached authorization
lease. This costs a control roundtrip and introduces a fail-closed availability
boundary. It avoids claiming instant revocation from eventually consistent caches.
The cell can still access all bound data resources if compromised; separate D1s
are not complete compute isolation.

The compiler supports only operations-v1, not arbitrary tenant metric expressions
or SQL. Broader joins/metric authoring and Git attestations require C07–C10/C20.

## Evidence

SQLite service-bound fixture tests, immutable bundle/activation/profile/routing
negative tests, batched query tests, React browser tests and generated deployment
SQL tests. Live Workers bindings and merchant correctness remain staging gates.
