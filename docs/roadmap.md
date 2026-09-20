# Roadmap: earn the right to become a platform

## North star

A customer connects one existing source, agrees on three metric definitions, sees
useful dashboards, and can trace every number to the source and period it represents.
The next customer reuses most of that work without a product fork.

"Databricks for SMEs" is strategic inspiration, not a mandate to build a compute
engine, notebook system and universal warehouse simultaneously.

## Stage 0: this bootstrap

Delivered locally: strict source snapshot contract, tenant isolation guards,
semantic compiler, immutable publication references, dashboard config editor,
operations-cost pack and negative tests. Not delivered: cloud certification or
real customer integrations. See [validation](../VALIDATION.md).

## First 7 days after publishing

Choose one design partner and one source with a readable export/API. Define three
metrics and their grain with the person who owns the business meaning. Include at
least one metric whose apparent improvement could be mistaken for cash savings.

Deploy isolated staging on Cloudflare, complete Access/workerd/cross-tenant gates,
then load a minimal approved dataset. Reconcile totals against a customer-approved
reference. Do not build a universal connector before this succeeds.

**Success gate:** one repeatable import, three reconciled metrics, two authorized
users, one useful decision, no unexplained discrepancy and no tenant leakage.
A demo compliment alone does not pass.

## Days 8-30: repeat the same job for three customers

Build one real connector adapter, asynchronous chunking with Queues/Workflows,
idempotent backfill checkpoints, source freshness states and operational limits.
Separate raw evidence retention from current serving data. Add one dashboard query
endpoint to pin all widgets to a single consistent snapshot efficiently.

Add controlled customer metric mappings, not arbitrary uploaded SQL. First expand
pack metadata to declare owner, source grain, unit, dimension ACL, exclusions and
validation examples. Ship measured job status, not a spinner hiding failed imports.

**Gate:** three approved sources/tenants, reusable pack logic, exact reconciliation
for supported integer totals, live cross-tenant negative tests and rollback/restore
exercise. Record setup hours and recurring cost, not just request latency.

## Days 31-90: productize onboarding and dashboard work

Add tenant provisioning/migration orchestration, configuration versioning and
reversible publish/rollback. Expand to a small number of valuable business packs.
Add a richer React/charting interface only when filter composition, drilldowns and
editing demand it; the semantic API remains unchanged.

Implement exports and embedded views only with scoped signed access, revocation,
tenant-aware cache keys, expiry and audit. Source credentials get an actual
isolated broker. Add semantic-plan proposals through a provider-neutral AI adapter;
they pass the same compiler/authorization path as a human query.

**Commercial gate:** the third installation of a repeated pack uses at least 70%
shared logic and takes materially fewer engineering hours than the first. Use an
initial target of one day or less for a repeatable small-source onboarding, then
replace that target with observed data. These are internal hypotheses, not promises.

## Days 90-180: analytical tier only if evidence requires it

Benchmark D1 serving marts at realistic cardinality and concurrency. Trigger an
analytical-tier evaluation on measured scan cost/latency, storage growth, isolation
requirements or transformations that no longer fit bounded workers.

Evaluate R2 Data Catalog/Iceberg/R2 SQL against an external analytical engine through
one adapter contract. Use a shadow query corpus and reconcile results, including
nulls, decimals, timezones and permissions. Beta dependencies stay optional until
customer reliability/cost requirements are satisfied. Do not build a lakehouse
because the diagram feels incomplete.

## Later: intelligence plus governed execution

A shared semantic catalog can power dashboards, CEO briefs, alerts and Lumi Agents
read tools. Add the smallest authorized interface first. Recommendations link back
to metric version and source evidence. Taking action remains a separate permissioned
workflow, not a dashboard's hidden side effect.

## Stop or change conditions

- Each customer needs a different app build: fix the pack/config boundary.
- Numbers cannot be reconciled: stop adding charts and fix semantics/data quality.
- Source access takes longer than the value horizon: choose a smaller source/wedge.
- D1 limits are becoming a design constraint: move the workload, not the goalposts.
- AI generates plausible definitions without a business owner: block publication.
- Infrastructure grows while no customer uses a dashboard for a real decision:
  pause platform expansion and observe the customer workflow again.

## Do not build now

A public marketplace, universal drag/drop canvas, arbitrary SQL SaaS, custom OLAP
engine, graph database, complete enterprise IAM, every ERP connector, cross-company
benchmarking or unreviewed autonomous business actions.

The durable assets are tested definitions, reusable source mappings, evidence,
tenant-safe contracts, operational runbooks and measured customer outcomes.
