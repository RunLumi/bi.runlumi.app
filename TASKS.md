# Initial execution backlog

These are local work items, **not GitHub issues already created**. Convert only
active work into issues after the repository is published.

| Priority | Work item | Acceptance evidence |
| --- | --- | --- |
| P0 | Publish bootstrap and inspect actual CI | Main exists; pinned install, tests and audit results recorded |
| P0 | Pin Wrangler and validate workerd bindings | Real Worker bundle, D1 batch/trigger behavior, assets routes |
| P0 | Deploy two-tenant synthetic canary | Live Access JWT verification, rotation, roles, cross-tenant denial |
| P0 | Tenant migration/restore safety | Recorded rollback and restore of A with B unaffected |
| P0 | Rate admission and cost guardrails | Per-principal/tenant abuse tests, query/import concurrency limit |
| P0 | First source adapter and reconciliation | Business owner signs off grain, definitions and exact totals |
| P1 | Queues + Workflows ingestion | Chunking, dedup, DLQ, retry/backfill/resume, schema drift tests |
| P1 | Atomic dashboard query | All widgets share one pinned snapshot and permission scope |
| P1 | Source freshness/completeness states | Stale/missing/partial shown separately; no misleading zero |
| P1 | Versioned metric models and mappings | AST allowlist, join-cardinality tests, currency/time/null rules |
| P1 | Tenant provisioning cell orchestrator | No account-wide query token, schema inventory, safe batching |
| P1 | Scoped source credential broker | No unrelated secret access or credential exposure to prompts |
| P2 | Rich dashboard editor / chart library | Measured editing use case, keyboard access, chart/table parity |
| P2 | Authorized export/embed | Expiry, revocation, tenant-safe caches, no public R2 buckets |
| P2 | Governed AI semantic-plan proposal | Same authorization/compiler path; source-linked explanation |
| Evidence gate | Analytical adapter evaluation | D1 benchmark demonstrates need; cross-engine golden queries pass |

Every completed item updates the capability table and validation record. Do not
close a task solely because a spec or stub was added.
