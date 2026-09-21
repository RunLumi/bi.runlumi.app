# 0010: Customer application repositories on a versioned product core

Status: superseded by the standalone customer authority model. Date: 2026-09-20.
Supersedes the blanket "no customer app fork" rule of
[ADR 0001](0001-shared-product-cells.md) and its restatement in
[ADR 0002](0002-cloudflare-data-roles.md), replaced by the precise distinction
below. It does not supersede the tenancy, identity, semantics or economics
invariants those ADRs establish.

## Decision

Split the product into a versioned shared core and independently generated
customer applications.

- **One upstream core.** `packages/core` (domain, semantics, contracts, governed
  commerce services), `packages/cloudflare` (Access verification, deployment
  identity, Worker assembly, local test adapters) and `packages/ui` (design system,
  shared screens, application composition). The initial packages share one
  coordinated version and are consumed as exact released artifacts.
- **One repository per customer application.** Generated from `starter/customer` by
  `npm run customer:new`, not a GitHub fork and not a copy of the monorepo. A
  customer repository holds only its composition, configuration, extensions,
  deployment inventory and docs.
- **One dedicated deployment per customer/environment.** Each customer Worker has
  its own hostname, Access audience, serving D1 (fixed `SERVING` binding), private
  R2 resources, secrets and enabled Queue/Workflow resources. It has no bindings to
  another customer's data.
- **Customer-owned authority.** A standalone customer deployment owns identity,
  memberships, entitlements, deployment configuration and audit records in its
  own serving resources. Customer Workers do not require a CONTROL binding or a
  request-time Lumi service.
- **Server-owned deployment identity.** The control plane owns a `deployments`
  registry. Every dedicated customer/environment and every shared cell scope is a
  registered row with its own reviewed Access team/audience, control interface
  version, hostname and lifecycle state (`registered`/`suspended`/`retired`). The
  `x-lumi-deployment` header is only a bounded locator — the registered row's
  team/audience and control version are the authority end-user JWTs are verified
  against, on both the control plane and dedicated customer Workers. Deployment
  identity never lives in a customer lock or request payload.

## Precise distinction that replaces "no customer app fork"

ADR 0001 rejected per-customer **forks of the product internals** because they
diverge security patches, schemas and metric meanings. That risk is real and
remains prohibited:

- Customer applications may differ in navigation, pages, dashboards, mappings,
  approved custom metrics, connector adapters, AI profiles and decision workflows.
- **Shared-core changes remain upstream.** A defect or feature in `packages/*` is
  fixed once upstream and delivered as a new core release; it is never patched
  independently inside a customer repository.
- Customer code depends on core through public package interfaces. Core never
  imports a customer. Dependency direction is enforced by `scripts/check-boundaries.mjs`,
  not by folder naming or CODEOWNERS.

## Compatibility with the existing cell model

ADR 0001's shared **cell** (one Worker serving several tenants in a bounded cell)
remains supported and unchanged for small tenants. The dedicated deployment is the
default target for a customer application that needs its own customization and
release cadence. `CellRoutingEnv.CUSTOMER_ID` is optional: when present, the same
reviewed core serves exactly one customer and rejects any other tenant id at the
deployment fence (`CUSTOMER_MISMATCH`). This is a configuration of one codebase,
not a second platform.

## Trust boundaries preserved

- **Authentication.** Cloudflare Access is still the browser sign-in; the packaged
  `verifyAccessToken` still validates `Cf-Access-Jwt-Assertion` against the exact
  issuer and audience, requires RS256, checks time claims, bounds JWKS fetching and
  fails closed. The exact issuer/audience are resolved from the server-owned
  deployment registry (`verifyRegisteredAccess`), never from a request header or a
  shared global audience. A successful login is not finance, export, configuration
  or admin permission.
- **Authorization.** Roles, entitlements and field scope remain server-side. A
  dedicated deployment validates the original user identity at the control
  boundary; a service binding is not proof of an end user.
- **Semantics and money.** Exact minor-unit money, unknown-versus-zero, cost
  history, deduplication, snapshot consistency and reviewed publication are carried
  into the shared core unchanged. Customer extensions may add namespaced metrics;
  they cannot silently redefine sales, profit or cash.
- **No arbitrary runtime code.** Customer extensions are TypeScript/React compiled
  into the application Worker under review. TypeScript interfaces are not a sandbox.
  Arbitrary plugins, `eval`, remote modules and unreviewed scripts are rejected.
  Truly untrusted executable extensions need a separately designed restricted
  execution boundary and are out of scope here.
- **No secret leakage into the browser.** Public browser configuration is separated
  from server-only configuration at the schema and bundling boundary. Credential
  references and internal endpoints do not enter browser bundles.
- **Migrations.** Core migrations remain immutable and checksummed and ship in the
  core tarball. Customer migrations live in a separate namespace and ledger and may
  add owned tables and indexes only.
- **Reverts.** Reverting a Worker version does not reverse a database migration,
  refund money or undo external actions. Upgrade output states this explicitly.

## Delivery model

- Customer applications consume **exact versions and lockfile integrity** from
  private scoped packages or vendored tarballs produced by `npm run core:pack`.
  Deployments bundle core artifacts; they do not fetch executable core code from
  GitHub or a registry at request time. A workspace symlink build is not accepted
  as packaging evidence.
- The core tarball records source commit, release digest, extension API version,
  template version and migration checksums in `lumi-core-manifest.json`, mirrored
  into the customer `lumi.lock.json`.
- Upgrades ship as reviewable diffs via the customer `npm run upgrade` command,
  which refuses a dirty tree and incompatible major/extension changes, reports
  migration deltas and preserves customer-owned files.

## Consequences

- Two maintenance modes coexist: upstream packages (reviewed, versioned, one
  release) and customer repositories (composition and configuration).
- The upstream repository must keep the extension API intentionally small and
  stable; a breaking change bumps the major and needs a documented migration.
- Dedicated Workers are **not** complete account/IAM isolation. Customers in the
  same Cloudflare account share that account's blast radius; deployment tokens
  should be scoped to their own resources, and a customer-managed account would
  additionally require authenticated transport rather than an implicit
  same-account service binding. This is documented, not assumed working.

## Alternatives considered

- **Native GitHub forks.** Rejected: forks invite divergent core patches and do not
  by themselves make a repository private.
- **Copy the whole monorepo per customer.** Rejected: duplicates platform internals
  and recreates the fork risk ADR 0001 identified.
- **Config-only theming.** Rejected as insufficient: the mission requires real
  customization of routes, pages, metrics, adapters, AI profiles and workflows.

## Evidence

`docs/implementation/10-customer-application-base.md` records the shipped paths,
the tested environments and the two-customer acceptance and upgrade demonstration.
Live Cloudflare certification (a real Access login, a real deployment, a real
customer-managed account) remains a separate, credentialed step and is explicitly
not claimed by this ADR.
