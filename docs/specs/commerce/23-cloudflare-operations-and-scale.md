# C23 — Cloudflare deployment, reliability, recovery and scale exits

Spec: C23 | Status: Target contract | Stage: P0 bounded cells; P1 managed operations; P2 analytical adapters

Owns: workload placement, capacity, infrastructure cost and recovery. Domain authority is C01/C22; delivery semantics are C06.

## Placement decisions

| Responsibility | Initial placement | Boundary |
|---|---|---|
| Web/UI and API gateway | Workers + Static Assets | One origin; auth before private APIs, preserve existing design |
| Central organization registry | Dedicated control Worker + control D1 | Metadata/routing/entitlements only; no universal tenant data access |
| Tenant serving marts/config | D1 per tenant behind bounded cell Worker | Small indexed workloads, stable identity checks and route epoch |
| Raw evidence, releases, exports | Private R2 | Retention/deletion aware, tenant-scoped object authority |
| Dispatch and retries | Queues + durable outbox | At-least-once/no-order assumptions; queue is not historical archive |
| Backfills and resumable coordination | Workflows | Bounded steps; not a bypass for CPU, SQL or API quotas |
| Quota/admission serialization | Durable Objects only where needed | Per-provider quota key/cell job control; no imaginary transaction with D1 |
| Query cache | Versioned scope-aware cache | Never membership/revocation truth; no public cache of private BI |
| Model access/telemetry | AI Gateway / Workers AI where certified | Tenant provider policy, payload logging disabled, model conformance |
| Semantic retrieval | Start catalog lookup; Vectorize when justified | Tenant/scope filtered; embeddings are not financial facts |
| Fleet/product telemetry | Metrics/logs, Analytics Engine if useful | Not the merchant financial ledger |
| Large analytical jobs | Evaluated external OLAP or R2/Iceberg path | Explicit asynchronous adapter, metric/security conformance |

Workers Static Assets supports a unified application deployment [F6]. Workflows orchestrate durable steps [F8]; they do not make arbitrary data processing fit inside a request.

## D1 boundaries

At review time the paid D1 limit is 10 GB per database, with a many-small-databases design and single-threaded database execution constraints. Account/binding/SQL limits must be rechecked before provisioning. [F1](../research/sources.md#f1)

- **C23-R01:** D1 is the hot serving store, not an unbounded warehouse. Preaggregate routine dashboards and bound raw-detail scans. Do not increase importer limits as a substitute for bulk design.
- **C23-R02:** cell size is an operational/security policy based on binding inventory, migration load, noisy-neighbor behavior and risk. The bootstrap's 50-tenant cap is a Lumi guardrail, not a Cloudflare limit.
- **C23-R03:** query execution never uses an account-wide management API token to dynamically reach arbitrary databases. Provisioning runs separately with narrowly scoped credentials.
- **C23-R04:** maintain per-tenant measures for database/retained-version bytes, row scans, write/index amplification, CPU, queue backlog, source throttle delay, inference spend and support effort. Free credits do not count as durable unit economics.
- **C23-R05:** isolate high-risk or heavy tenants with a dedicated cell/account if justified; keep the same application release and pack contracts.

## Migration triggers

Initial internal warning threshold: 60% serving storage or sustained query/write contention; start an evaluated migration plan at 70% or a forecast of reaching 80% within 30 days. These are conservative **product policies**, not vendor limits or proof every tenant needs OLAP. Also trigger investigation when bounded indexed dashboard p95 misses its agreed SLO under representative load or ingestion/reconciliation repeatedly starves query serving.

First options: reduce retention in hot marts with raw history retained according to policy; improve indexes/aggregates; split workload by verified serving partition; move cold/large scans to an analytical adapter. Benchmark DuckDB for bounded batch jobs, ClickHouse or managed warehouses for recurring OLAP, and R2 Data Catalog/SQL where capability and maturity fit. Do not install Spark/Kubernetes just because the strategy mentions Databricks.

R2 SQL is open beta as of review [F5]. It may be evaluated, but a paid critical-path SLA needs evidence for required SQL features, auth, consistency, limits, cost, recovery and fallback. Every new engine runs the same exact-money, null, timezone, join-cardinality, scope and snapshot conformance fixtures. Dialect differences cannot change metric meaning silently.

## Operations and failure containment

Provision via reviewed inventory → create DB/bindings/storage → migrations → tenant identity assertion → source installation → data validation → activation. Schema migrations are additive/expand-contract, canaried, idempotent and version-gated. A partial tenant migration cannot block all cells. Unknown schema version fails safely.

Per-tenant job fairness and rate limits prevent one backfill saturating provider keys or shared Worker budgets. Bulk exports and AI investigations use separate budgets from essential source recovery and data-health views. Central control outages do not grant extra authority; C01 defines bounded lease behavior.

## Recovery contract

Back up/recover control metadata, tenant data, raw objects, publication manifests, schema/normalizer versions, deletion ledger and credential metadata consistently. D1 Time Travel is one component, not a pipeline restore [F1]. Avoid reviving stale credentials, old route epochs or already-executed actions.

Provisional P0 recovery objectives: no loss of acknowledged raw receipts within verified retained storage, and operator-led restoration of one pilot tenant within one business day. These are test objectives, not an external zero-RPO guarantee. P1 defines measured RPO/RTO by service tier from rehearsals.

Recovery flow: fence writers/readers → restore/rebuild tenant → replay deletion/suppression ledger → replay accepted receipts under pinned transforms → reconcile source controls → build candidate manifest → validate → activate newer route/data epoch → resume jobs. Test interruption at each step. Config rollback never rewinds external side effects.

## Acceptance

- **C23-A01:** one tenant's burst backfill cannot breach another pilot's declared query/ingestion budget in the load fixture.
- **C23-A02:** approaching storage threshold produces a measured capacity plan before quota exhaustion.
- **C23-A03:** tenant migration preserves identity and single active route; old cell refuses new work after fencing.
- **C23-A04:** restore/replay reconstructs certified totals and deletion state without duplicate orders/financial actions.
- **C23-A05:** alternate analytical engine passes identical metric/scope fixtures before routing live queries.
- **C23-A06:** actual resource/AI/support usage can be attributed to a tenant and product feature, with no unverified blanket cost estimate.
- **C23-A07:** failure of optional vector/AI features leaves deterministic financial views and source health usable.
