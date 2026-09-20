# Cloudflare product decisions

Reviewed against official documentation on 2026-09-20. Sources and limitations
are in [references](references.md). This is a deployment plan, not a claim that
these resources have been provisioned.

| Service | Role | Status in this bootstrap |
| --- | --- | --- |
| Workers + Static Assets | Same-origin UI/API; static CDN delivery | Entry/config generation implemented; not cloud-deployed |
| Cloudflare Access | Pilot workforce/customer-operator identity gate | Narrow JWT boundary implemented; live validation pending |
| D1 control | Membership, tenant registry, cell routing | SQL schema and actual SQLite tests |
| D1 per tenant | Curated small analytical serving marts/config | SQL/compiler/publication tests |
| Private R2 | Snapshot archive, later exports/artifacts | Binding port and local object-store test double |
| Queues | Bounded ingestion fan-out, retries and dead letters | Planned, not enabled |
| Workflows | Durable ingest/backfill orchestration | Planned, not enabled |
| Durable Objects | Per-tenant coordination, leases or strict limits | Deferred until measured need |
| KV / Cache API | Public immutable config or authorized snapshot caches | Deferred; never identity authority |
| R2 Data Catalog + R2 SQL | Optional Iceberg analytical tier | Evaluation path; open beta, not a mandatory dependency |
| Hyperdrive | External PostgreSQL/MySQL connection layer | Optional adapter path; not a warehouse |
| Workers AI / AI Gateway | Governed analysis/proposed semantic plans | Planned; provider adapter boundary first |
| Vectorize | Permission-filtered semantic metadata retrieval | Only when retrieval quality requires it |
| Analytics Engine | Operational usage telemetry | Never the financial source of truth |
| Pages | Existing marketing/static projects if already useful | Not a second deployment pipeline for this new app |

## Why Workers + Static Assets, not a separate Pages app?

Workers can serve the application assets and execute its API from one deployment.
That gives this small team one origin, fewer routing/CORS mistakes and one release
unit. Existing Pages projects do not need migration just for architectural fashion.
This decision is about this new app, not a claim that Pages is discontinued.

## Why D1 is not the entire BI warehouse

Official D1 guidance describes horizontal scale across smaller databases. The paid
per-database cap is 10 GB and each database processes queries single-threadedly.
Use it for small curated marts with indexed, bounded queries. Do not put unrestricted
scans, giant joins or a whole enterprise event lake behind a dashboard request.

The expansion path is private R2 columnar objects, reviewed transformation jobs,
then a tested analytical adapter. R2 SQL is currently open beta over Iceberg tables
managed by R2 Data Catalog. Evaluate SQL coverage, permissions, limits, cost and
failure behavior before making it a customer SLA dependency. An external analytical
engine is preferable to a misleading "100% Cloudflare" promise when requirements
exceed the current platform fit.

## Consistency and retries

D1 batch transactions provide atomic database publication; R2 writes remain a
separate operation. Queue processing is at-least-once, so idempotency must be real.
KV is eventually consistent and unsuitable as the single authority for revocation
or a duplicate-processing fence. Hyperdrive query caching is enabled by default;
review/disable it for security-sensitive or read-after-write state.

## Credentials and customer geography

Runtime uses bindings, not Cloudflare management tokens. Provisioning credentials
stay in a separate deployment context. Per-customer source credentials belong in a
scoped secrets system, not dashboard JSON, D1 text fields or client bundles.

An edge network does not imply that all storage or inference stays in Vietnam.
Review product location/jurisdiction controls, vendor terms and customer requirements
before importing regulated or location-constrained data. Do not infer compliance
from a product region label.

## Cost discipline

Track per tenant: Worker requests/CPU, D1 rows read/written, storage, R2 operations,
queue attempts, workflow retries, scan bytes, inference, and human implementation/
support hours. Large reads and repeated refreshes can dominate nominal hosting cost.

Do not assume credits or free tiers make the product free. Record observed usage,
current account pricing, retry amplification and p95 latency before quoting recurring
fees. Add budgets and workload admission before allowing broad customer querying.
