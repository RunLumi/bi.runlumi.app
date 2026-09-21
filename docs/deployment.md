# Deployment and first-customer runbook

**No Cloudflare resources have been created by this bootstrap.** The config
compiler is local and deliberately refuses blank IDs. Do not skip the release
gates in [SECURITY](../SECURITY.md).

## 1. Validate and publish source

Run `npm run setup`, `npm run check`, `npm run check:commerce`,
`npm run check:web-deps`, `npm run build:web`, and the synthetic local demo.
Publish through a reviewed pull request using the workflow in [README](../README.md).
Inspect actual GitHub CI results. There is no automatic deployment workflow.

Use a reviewed, explicitly pinned Wrangler CLI in your deployment environment.
Wrangler/workerd could not be installed or exercised in the bootstrap environment;
this package does not invent a tested version or include an unverified transitive
lockfile. Before the first remote canary, pin the selected supported version in
the deployment toolchain and record it in `VALIDATION.md` with its actual results.
Avoid unreviewed `npx ...@latest` in a production deploy pipeline.

## 2. Provision isolated staging resources

Using an authorized Cloudflare administrator or deployment token, create:

- a staging data-cell Worker and real custom hostname;
- one central control Worker and control D1;
- one private R2 PACKS bucket for reviewed configuration bundles;
- one serving D1 per tenant;
- one private R2 snapshot bucket for the cell;
- an Access application protecting the hostname, with explicit allow policy.

These are account writes/billable resources. Review them before execution. Keep
deployment tokens out of the application environment. Disable public `workers.dev`
and preview URLs. The API independently validates JWTs even if ingress is misrouted.
Do not place production data in previews, CI or local fixtures.

## 3. Create a private deployment inventory

Copy `infra/cell.example.json` to `.local/cell.json`. Set real account/database IDs,
worker name, hostname, Access team and Access application audience. Those identifiers
are not API secrets, but the inventory still contains customer/ownership metadata
and stays outside Git.

Every tenant must have a distinct database ID and binding. `ownerSubject` is the
verified Access subject, not a display name or guessed email. Confirm identity
from a valid login flow before granting membership. Source registrations need
human review of ownership, non-overlapping grain and expected data categories.

```bash
npm run cf:config -- .local/cell.json
```

The command generates `.generated/wrangler.control.json`,
`.generated/wrangler.<cellId>.json`, and bootstrap SQL for
control/tenant databases. Review each file. The SQL uses INSERT, not destructive
UPSERT, so re-running provisioning cannot silently reroute an existing tenant.
The bootstrap also registers the cell's Access scope in the control `deployments`
registry, so the control service verifies this cell's end-user JWTs against the
reviewed cell team and audience rather than a global audience.
The generator does not create resources, migrate databases or deploy code.

## 4. Migrate both planes; deploy control before cells

Examples below assume a reviewed Wrangler is on PATH and cell ID `sg-01`.
The bindings and config come from the generated inventory, not these sample names.

```bash
# Control config is the ONLY config binding CONTROL_DB and PACKS.
wrangler d1 migrations apply CONTROL_DB --remote --config .generated/wrangler.control.json
wrangler d1 execute CONTROL_DB --remote --config .generated/wrangler.control.json --file .generated/control-bootstrap.sql

# Repeat for EACH reviewed tenant binding. Includes additive route-fence migration.
wrangler d1 migrations apply TENANT_A --remote --config .generated/wrangler.sg-01.json
wrangler d1 execute TENANT_A --remote --config .generated/wrangler.sg-01.json --file .generated/tenant-customer-a-bootstrap.sql

# Build assets before validating either deployment.
npm run build:web
wrangler deploy --dry-run --config .generated/wrangler.control.json
wrangler deploy --dry-run --config .generated/wrangler.sg-01.json

# Explicitly authorized deployment only: private control service FIRST.
wrangler deploy --config .generated/wrangler.control.json
wrangler deploy --config .generated/wrangler.sg-01.json
```

Every deployment — dedicated customer environment or shared cell scope — is a
registered row in the control `deployments` registry with its own reviewed Access
team and audience, control interface version and lifecycle state. Control verifies
each forwarded end-user JWT against that registered row; there is no shared global
audience. Never register a deployment whose audience differs from the reviewed
Access application protecting its hostname, and never overwrite an existing
registration with different identity — update state or retract first.

Bootstrap SQL creates memberships, not commercial authority. Provision a reviewed
initial row in `licenses` using the control config before expecting data access.
Set actual agreed plan, start/end, grace and allowed features; no perpetual license
is granted by the generator. Keep this SQL in `.local/`, not Git. License changes
then use operator API with `If-Match` and a reason. A platform operator is explicitly
added to `users` / `platform_operators`; being a tenant owner never grants that role.

Register `pack_sources` only after verifying who controls that repository and path.
The current API accepts **operator-asserted** compiled bundles. It does not fetch
GitHub, validate installation/OIDC identity, or attest a reviewed PR. Do not wire a
customer-controlled workflow directly to these privileged operator routes. Every
future automated publisher needs the C20 source-attestation gate first.

These commands are a runbook, not commands executed by this PR. Cell names do not
establish data residency. Validate real Access, D1 Sessions/batch, R2, static routing
and CSP in staging before any customer data or certification.

## 5. Authenticated staging acceptance

Use two independent tenant logins and a viewer account. Test directly against real
API routes, not only browser visibility:

- missing/invalid/wrong-audience JWT denied;
- valid tenant A identity cannot read tenant B;
- wrong database binding causes fail-closed identity mismatch;
- viewer cannot edit/import; editor can configure, owner can import;
- removed membership is denied on the next request;
- CSP and Access routing behave as expected;
- failed/retried imports never duplicate or partially publish;
- concurrent dashboard revisions conflict rather than overwrite;
- latest data and metadata reconcile to the same source snapshot.

Send only approved synthetic snapshots in this step. The production import source
ID must match registration. The supplied fixture uses `ops-demo`; the inventory
example uses `operations`. Map deliberately rather than silently accepting any ID.

## 6. Canary, then real data

Add rate limits/admission, minimal failure telemetry, cost alerts and a named
incident owner before a real customer pilot. Measure query rows read and latency
at representative size/concurrency; the local SQLite adapter is not a performance
model of D1.

A canary must prove rollback and one-tenant restore. Keep old release artifacts,
migration state, object references and semantic definition version. Mark the
service production-ready only after recorded gates pass, not by flipping a flag
while the implementation is still a bootstrap.

## Schema rollout

Migrations are additive and immutable once applied. Use expand -> backfill ->
verify -> switch reads -> contract in a later release. Track per-tenant schema
version and canary a cell before a fleet rollout. Do not discover incompatible
customer schemas through failing dashboard queries.

Initial migration uses IF NOT EXISTS for fixture reuse. Production relies on the
Wrangler migration ledger, not on mutating the first migration and hoping it runs
again. New changes become new migration files.

## Restore and offboarding

Suspend tenant access and imports first. Restore the tenant's serving database to
a verified point, reconcile active snapshot pointers with retained R2 objects,
recheck database identity and membership, then re-enable. Never repoint a tenant
to another customer's database as a recovery shortcut.

D1 Time Travel is not a complete backup strategy. Record recovery point and time
objectives, export policies, object retention and dependency on Cloudflare account
access. Offboarding covers memberships, credentials, raw/derived data, evidence,
caches, exports and legally required retention. Test the process with synthetic data.

## Configuration activation and rollback

`POST /api/control/tenants/:id/activation` takes `{releaseId, routeEpoch, reason}`
and a strong `If-Match: "<configuration revision>"`. Obtain the current route epoch
from the authorized control overview. The control transaction checks active tenant,
route epoch and expected deployment revision. A stale activation fails; re-read and
review instead of blindly retrying. Activation rechecks R2 hash, supported pack
schema/semantic version and enabled AI profile ownership. Profile entries contain
only opaque IDs, never keys. Revoked profiles fail closed on activation and reads.

This implements configuration-pointer rollback for the existing `operations-v1`
contract. It does NOT implement cross-data-schema rollback, arbitrary metrics, source
mapping migration, dependency graphs or production Git attestations. Do not describe
it as full C20 certification.

## Fenced tenant movement

There is no self-service movement API. An operator maintenance procedure must suspend
new work, drain admitted requests/imports, copy and reconcile data, advance route epoch
in the reviewed central route and target `tenant_identity`, verify new-cell bindings,
then reactivate. Old copies with a stale epoch are rejected on admission. Restore must
not restore an old epoch into service. Database-per-tenant alone is not a complete
migration protocol. Concurrent fleet cutover, replay recovery and in-flight revocation
remain staging gates; fail closed rather than serving through a stale copy.
