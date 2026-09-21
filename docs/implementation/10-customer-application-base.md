# 10 — Customer application base (reusable core, generated customers)

Status: implemented and locally verified. Date: 2026-09-20.
Canonical decision: [ADR 0010](../adr/0010-customer-application-repositories.md).

## What shipped

- **Three versioned packages** built from the former flat `packages/core` files and
  the `apps/api` application services:
  - `packages/core` — domain contracts (`contracts`, `semantics`, `licensing`,
    `tenant-pack`), governed commerce services (`commerce-*`), the application API
    (`api`, `query`, `ingest`, `tenant`, `control-client`), the customer
    configuration schema (`customer-config`) and the coordinated version
    (`version`).
  - `packages/cloudflare` — Access verification (`auth`), Worker assembly
    (`cell`), dedicated deployment identity and fence (`deployment`), and local
    test adapters (`testing`).
  - `packages/ui` — design system components, shared feature screens, data clients
    and the `createApp` composition API (`app.tsx`).
- **A minimal customer starter** at `starter/customer` and a generator,
  `npm run customer:new`, that emits a private-by-default application repository
  with `customer/`, `apps/web`, `apps/worker`, `infra/`, `docs/`, vendored exact
  core tarballs and `lumi.lock.json` provenance. Generation now produces one
  **per-environment deployment inventory** (`infra/environments/<env>.json`,
  schema v2): distinct worker name, hostname, random 32-hex Access audience,
  serving D1 name/id, sources bucket and deployment id for each environment, with
  `production` as the Wrangler base and other environments as named `env.*`
  sections (`migrations_dir` resolves to the customer repo root).
- **Server-owned deployment identity.** The control plane owns a `deployments`
  registry (`0005_deployments.sql`) — one row per dedicated customer/environment
  (unique on customer+environment) plus one shared cell scope row (NULL customer).
  Rows carry the reviewed Access team/audience, control interface version and
  lifecycle state. `verifyRegisteredAccess` (packages/cloudflare `auth.ts`)
  resolves `x-lumi-deployment` to a registered row and verifies the end-user JWT
  against that row's team/audience with a real RS256/JWKS check; the control
  service authenticates every request through it. The dedicated serving D1 must
  additionally declare the same customer/deployment/environment in
  `serving_identity` (`0009_serving_identity.sql`); a swapped, foreign or unseeded
  database fails closed with `SERVING_IDENTITY_MISMATCH`.
- **Operator-only registration.** `POST/GET /control/admin/deployments` and
  `PUT /control/admin/deployments/<id>/state` (audited against the owning tenant)
  register customer deployments and transition registered↔suspended→retired;
  cell scopes are registered by the reviewed control-bootstrap SQL, never a runtime
  endpoint. Placeholder Access teams, `example`/workers.dev hostnames, uniform or
  short audiences, wrong control interface versions and reused resources are
  rejected.
- **Two-gate validation.** `npm run validate` (scaffold correctness: identity,
  reserved routes, wrangler/inventory agreement, cross-environment distinctness,
  migration baselines) and `npm run deploy:plan <env>` (deployable-release gate:
  blocks unreviewed hostnames, scaffold Access teams, placeholder/zero D1 ids, and
  prints the `wrangler deploy` command without creating any resource).
  `lumi.lock.json` stays **customer-level** — no deployment id or environment.
- **Enforceable boundaries**: `scripts/check-boundaries.mjs` (with non-vacuous
  negative tests in `tests/boundaries.test.mjs`) rejects application imports in
  core, server modules or node builtins in browser bundles, cross-package deep
  imports and upward dependencies.
- **Reproducible core delivery**: `npm run core:pack` builds deterministic tarballs
  and a `lumi-core-manifest.json` recording source commit, release digest,
  extension API version, template version and migration checksums. Migrations ship
  inside the core package. The command refuses a dirty tree.
- **Reviewed upgrade**: `npm run upgrade -- --check` (plan) and `npm run upgrade`
  (apply) in a customer repository. It refuses a dirty tree, rejects incompatible
  major/extension changes, reports migration deltas and preserves customer files.
- **Configuration validation**: `parseCustomerManifest`, `parseCustomerRoutes` and
  `assertCompatible` in `packages/core/src/customer-config.ts`, invoked by the
  customer `validate` command and CI.
- **Executable starter extensions.** Generated Workers now register reviewed custom
  metrics, authorized-export connector adapters and advisory decision rules through
  bounded core contracts. Module enablement is enforced server-side. Validation
  rejects declaration/registration drift, placeholder metric readers, unsafe rule
  shapes and missing AI prompt references; AI deployment stays disabled until its
  provider, model and credential references are reviewed. The included connector is
  a deterministic synthetic operations fixture, not a live commerce integration.
- **Saved insight lifecycle (first vertical slice).** Owner-only insight artifacts
  persist a validated definition and stable block IDs, with each run pinned to one
  published report, content hash, resolved period, query definition and exact result
  cells. Reload returns the artifact and all runs; refresh appends a new run under an
  optimistic revision check instead of rewriting history. This is the deterministic
  publication-backed path, not model inference or a general report language.
- **Bounded source breakdown.** `commerce-query` now accepts the reviewed `source`
  dimension with a bounded limit and date range, and computes exact sales/order
  metrics from canonical published orders. Unsupported dimensions, sensitive metric
  combinations and unbounded limits remain rejected; aggregate and breakdown results
  retain the same publication pin and authorization scope.
- **Explicit comparable periods.** A query may pin a second explicit date window;
  the server executes current and comparison windows independently against the same
  publication and returns separate exact cells. Invalid dates and reversed windows
  fail closed; relative labels and implicit period inference are not accepted.

## Verified environments

- **Local (this repository).** `npm run check` — package build, typecheck, 294
  unit/SQLite tests, repository checks (including the starter lock↔migration
  baseline gate), boundary checks and the licensing gate.
- **Local workerd.** `node scripts/workerd-check.mjs` runs a thin Worker composed
  only from packaged artifacts under `wrangler dev` (local workerd, no account).
  6/6 checks: the packaged module graph evaluates; a missing or unconfigured Access
  token fails closed; an email/header shortcut never authenticates; a non-configured
  tenant id is denied at the deployment fence; an unknown API path returns JSON; and
  static assets are served.
- **Dedicated deployment semantics.** `tests/dedicated-deployment.test.mjs` — the
  deployment fence rejects a foreign tenant id, identical business IDs cannot cross
  a swapped binding, viewer is denied owner-only routes, a revoked membership and a
  machine actor without an end-user identity fail closed, the session lists only
  the configured customer, and a serving D1 swapped to the same customer's other
  environment, to another customer, or with no declared `serving_identity` all fail
  closed with `SERVING_IDENTITY_MISMATCH`; a dedicated Worker refuses to proxy
  fleet-administration endpoints (`CONTROL_ADMIN_DENIED`).
- **Deployment registry matrix.** `tests/deployments.test.mjs` — real RS256 Access
  JWTs minted per team: a registered A-production token verifies to its principal;
  an A-staging or B token presented to A-production fails; unknown deployments,
  missing locator/JWT, suspended deployments, control-interface version mismatch and
  cell-scope verification all fail closed; operator registration/list/state
  endpoints reject duplicates, unknown tenants, non-customer cell scopes,
  placeholder teams, `example`/workers.dev hostnames, uniform/short/oversized
  audiences, wrong versions and invalid environments; lifecycle transitions are
  audited against the owning tenant and retire is terminal. Generation distinctness
  (worker/hostname/database/bucket/audience/deployment id across production and
  staging) and the customer-level lock are asserted hermetically.
- **Two-customer acceptance + upgrade.**
  `node scripts/acceptance-two-customers.mjs` — 15/15 checks: both applications
  install from real tarballs (not symlinks) and build without upstream source
  paths; production and staging own distinct deployment identities with matching
  Wrangler `env` sections and a customer-level lock; `deploy:plan` blocks the
  unreviewed scaffold and approves after operator review (creating no resource);
  each has distinct custom pages and namespaced metrics; a reserved-route collision
  and a bad customer id are rejected with diagnostics; a synthetic N+1 core release
  upgrades both applications while customer files stay byte-identical; one
  customer's rollback to N leaves the other at N+1 and the migration-limit guidance
  is present. Each customer fixture also carries its own executable server metric
  registration, rather than a UI-only value placeholder.

## Remaining prerequisites (not claimed here)

- **Authenticated Cloudflare staging.** A real Access login, a real deployment to a
  customer hostname, real D1/R2/Queue bindings and real control authority. Local
  and workerd evidence is reported separately; no live certification is claimed.
- **Registry-published packages.** Packaging currently produces vendored tarballs.
  Publishing to a private scoped registry requires registry credentials and
  visibility confirmation and is not exercised here.
- **Customer-managed accounts.** Same-account service bindings are used. A
  customer-owned Cloudflare account would additionally require authenticated
  transport and is not implemented.
- **Dedicated account/IAM isolation.** Dedicated Workers are not complete isolation;
  residual account-wide blast radius is documented in ADR 0010.

## Feature gaps deliberately not closed

The reusable base does not implement live provider connectors, general commerce
semantic querying, forecasting, Ask Lumi inference, scheduled delivery or agent
execution. Those remain the C00–C27 feature work; this record covers the base
architecture only.
