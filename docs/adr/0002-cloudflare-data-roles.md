# 0002: Cloudflare-first without turning D1 into a warehouse

Status: accepted for bootstrap. Date: 2026-09-20.

## Decision

Serve web/API with Workers + Static Assets. Use D1 for control and small curated
serving data; R2 for private snapshot archives. Add Queues/Workflows for real
asynchronous ingestion. Preserve a semantic analytical-adapter boundary.

## Why

The small team benefits from one deploy unit and managed primitives. Interactive
queries remain bounded and indexed. The platform is not defined by using every
Cloudflare product, but by reliable and economical customer outcomes.

## Limits

Do not depend on R2 SQL beta for a committed reliability promise without validation.
Hyperdrive is an external SQL connectivity option, not a universal analytical engine.
KV does not become membership/idempotency authority. A workload too big or expensive
for D1 moves to a tested analytical tier instead of gaining a higher synchronous cap.

## Revisit

Measure scan rows/bytes, p95 latency, data growth, query concurrency and dollars per
useful dashboard. Only then choose R2/Iceberg/SQL or an external engine. Preserve
metric/query semantics and authorize at every adapter. Sources: CF-01 to CF-10 in
[references](../references.md).
