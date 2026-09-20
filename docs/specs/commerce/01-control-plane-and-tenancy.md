# C01 — Central control plane and tenant data boundaries

Spec: C01 | Status: Target contract | Stage: P0–P3

Owns: organization identity, users, memberships, route ownership and tenant lifecycle. Excludes: source credentials/content (C02/C22), physical placement details (C23), billing calculations (C24).

## Outcome and migration delta

One shared product release serves many businesses without cross-tenant access. The end-state has a **central control Worker + control D1** for global identity, tenant registry, memberships, license/entitlement versions and cell routing. Bounded cell Workers own tenant serving D1 access. The bootstrap's per-cell control DB is an existing implementation, not proof that this central control service is already present.

Migrate incrementally: establish stable global IDs; create the central registry; validate replicated membership/route versions; canary one cell; switch authenticated route resolution; retire duplicate authority only after reconciliation. Do not perform an all-at-once tenant migration to satisfy the diagram.

## Contract

- **C01-R01:** derive principal from verified identity, never headers or query parameters asserted by the browser. A principal may belong to multiple tenants; membership is checked for every requested tenant.
- **C01-R02:** route is resolved from a server-owned `(tenant_id, route_epoch)` registry. No client, LLM, Git pack or queued payload may supply an arbitrary D1 ID or binding name. After routing, the tenant database identity must match.
- **C01-R03:** central control has no bindings granting read access to all commerce databases. Provisioning credentials are separate from interactive request credentials. The control plane stores metadata, not order/customer facts.
- **C01-R04:** finance, stock and merchant identity boundaries remain inside a tenant. Multiple storefronts are usually dimensions, not tenants. An unrelated agency client is a distinct tenant. Consolidated portfolio reporting needs explicit grants to each constituent and is unavailable by default.
- **C01-R05:** authorization applies to rows, columns, metrics, source evidence, drill-down, exports, cache, AI retrieval and background jobs. Hiding a navigation tab is insufficient.

## Domain and roles

Entities: Organization/Tenant, Principal, Membership, RoleBinding, ResourceScope, CellRoute, EntitlementSnapshot, SupportGrant, TenantLifecycleEvent.

Initial roles: owner/admin; data steward; analyst/editor; viewer; integration service. Layer resource scopes for legal entity, shop, warehouse and sensitive cost/PII columns. Owner status is not a platform-wide privilege. Finance cost access can be denied while permitting stock quantities.

Support access is time-bound, purpose-bound, tenant-approved and audited. No shared super-admin login into customer data. P2 adds SSO/SCIM and partner delegation without flattening the boundaries.

## Route and membership consistency

A control-issued delegation contains principal, tenant, cell, scope digest, membership revision, entitlement revision, route epoch, audience and short expiry; authenticate service-to-service transport as well. The cell validates all fields and current revocation epoch. Prototype lease/cache duration is a configurable engineering budget, not permission for delayed financial authorization.

For exports, PII, credential changes and action handoff, consult current authority. If authority cannot be confirmed, fail closed. For lower-risk reads, a still-valid narrowly scoped lease may be accepted within its documented revocation window. Do not claim immediate global revocation while relying on cached leases. Never use eventually consistent KV as sole revocation authority.

Moving a tenant uses provision → copy/replay → verify → fenced cutover → retire. Each cell checks route epoch so an old cell cannot continue serving after cutover. Cross-store/global consolidated reads pin authorized tenant snapshots and do not use a management token to enumerate databases.

## Lifecycle

`PROVISIONING → VALIDATING → ACTIVE → SUSPENDED → EXPORT_PENDING → DELETING → DELETED`, with failure states retaining an operator recovery path. Suspension blocks new billable work but follows the agreed retention/export contract; it does not silently delete evidence. Deletion propagates to source tokens, queues, datasets, exports, AI memory and backups under C22/C23.

## Acceptance

- **C01-A01:** authenticated A requests B by URL, source ID, R2 ref, cache key, AI tool argument and export ID: every request is denied without exposing existence/contents unnecessarily.
- **C01-A02:** swapped D1 bindings fail the database identity assertion.
- **C01-A03:** a revoked user cannot start an export with a stale read lease; ordinary-read revocation latency matches the declared maximum.
- **C01-A04:** two cells racing a migration cannot both publish/serve under the same active route epoch.
- **C01-A05:** an agency user can access only explicitly delegated merchants; multi-tenant aggregates omit unauthorized merchants and disclose the selected scope.
- **C01-A06:** control outage leaves no default tenant, no fallback administrative credential and no new authority.
