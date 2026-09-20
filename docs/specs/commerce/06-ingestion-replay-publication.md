# C06 — Durable ingestion, replay and publication

Spec: C06 | Status: Target contract | Stage: P0–P3

Owns: accepted-source durability, backfill, incremental sync, state recovery and atomic publication. Excludes: vendor authentication rules (C03–C05), semantic interpretation (C07/C09), quality thresholds (C08).

## Outcome

An accepted source change is either visible in a verified dataset or visibly awaiting/quarantined/rejected; it is never silently lost. Repeated delivery changes transport statistics, not business totals.

## Contract

- **C06-R01:** verify source identity before accepting data. Bound body size, decompression, pagination and resource scope. Incoming payloads are untrusted data, not instructions or routing authority.
- **C06-R02:** persist authorized raw content before acknowledging success to a provider. P0 path: write a deterministic private R2 object, then a durable tenant receipt/outbox in D1; only then ACK. Queue dispatch follows the outbox. If a crash happens between R2 and D1, retry adopts the same object or orphan recovery repairs it. No claim of a cross-product transaction.
- **C06-R03:** Queues messages carry opaque tenant/connection/receipt references, not credentials or large PII bodies. Consumers revalidate current connection status and receipt identity. Delivery may repeat or be out of order. [F2/F3](../research/sources.md)
- **C06-R04:** separate three checkpoints: durable raw acceptance, normalized revision, published data version. Advancing one does not imply the others. A failed normalizer must not make raw collection look current at the dashboard.
- **C06-R05:** every stage is replayable under pinned connector/normalizer/mapping versions. Outbox sweep and reconciliation repair dropped dispatches; a DLQ is not a permanent archive.

## RawEnvelope and receipt

Required envelope fields: envelope_id, tenant_id, source_account_id, connection_id, provider, resource_type, source_object_id, source_revision when available, event_type, source_event_at, source_updated_at, received_at, request_window, source_cursor, schema_fingerprint, content_hash, object_ref and authorization_coverage_ref. Never store auth headers.

Dedupe receipt key prefers provider event identity scoped to source account; fallback uses declared entity/revision/hash semantics. Identical payloads at different stock observation times may still be distinct observations. Missing event IDs cannot justify deduping all same-value events forever.

Receipt states: `ACCEPTED → NORMALIZING → NORMALIZED → RECONCILING → PUBLISHED`; side paths `RETRY_PENDING`, `QUARANTINED`, `DEAD_LETTERED`, `REVOKED`. All terminal/nonterminal transitions carry timestamps and stable reason codes.

## Backfill and deltas

Backfill is a partitioned job with immutable requested interval, coverage targets, page cursor, cutoff, retry budget and progress counters. Delta polling overlaps the last confirmed source-time boundary to catch delayed writes; dedupe handles overlap. Bound inclusivity according to each provider contract. Source create IDs alone do not detect updates to older entities.

Webhooks reduce latency, not the need for daily/periodic reconciliation. If a source does not expose stable update timestamps, use entity checks, rolling windows, manifest comparisons or slower full checks. Do not promise a source-time freshness SLO when the source exposes no trustworthy clock.

Rate coordination respects provider quota keys across all workers. Use bounded exponential backoff with jitter, explicit retry-after/unlock time, retry caps and fair scheduling so one large merchant cannot starve others. Reauth failures pause new reads, not endless retry loops. Lease/fencing tokens prevent concurrent jobs advancing the same checkpoint backward.

## Publication algorithm

1. Persist raw receipt.
2. Normalize into staged canonical revisions under a `build_id`.
3. Run grain, identity, monetary and coverage expectations.
4. Build serving partitions/aggregates for a candidate `data_version`.
5. Persist an immutable publication manifest containing component revision watermarks, counts, hashes, quality certificates and dependency versions.
6. Atomically compare-and-swap active manifest pointer in tenant D1 against expected predecessor and route epoch.
7. Invalidate by versioned cache identity; emit idempotent publication event.

Queries use manifest-addressable facts/aggregates, not half-mutated latest tables. P0 may copy bounded windows into immutable publication partitions. Larger storage adapters may use MVCC/table snapshots, but must preserve the same contract. Pruning keeps active and retained manifest dependencies; it cannot delete rows needed by an in-flight query.

Corrections build a new version. Replaying under a new normalizer never silently mutates a historical report. Deletion policy is C22; immutability means no in-place editorial rewrite during retention, not retaining PII forever.

## Scale boundary

P0 stores modest raw objects individually for simple durable acknowledgement. Later encrypted compressed segments reduce object-operation cost, but only after a durable staging log, membership manifest and crash tests exist. Never buffer acknowledged events solely in Worker memory to save R2 operations.

## Acceptance

- **C06-A01:** inject crash after R2 write/before receipt; retry results in one receipt and recoverable orphan, not data loss.
- **C06-A02:** inject crash after receipt/before Queue dispatch; outbox sweep processes it once logically.
- **C06-A03:** deliver each event repeatedly and permute order; canonical state and published money totals match the reference run.
- **C06-A04:** schema drift preserves raw evidence, quarantines affected facts and visibly reduces coverage without returning endless webhook 500s.
- **C06-A05:** a competing stale backfill cannot move active publication or checkpoint backward.
- **C06-A06:** reader during publication sees entirely predecessor or successor manifest, never mixed dashboard versions.
- **C06-A07:** prolonged provider outage, expired Queue/DLQ messages and worker restart recover from durable receipts and raw storage within the stated recovery budget.
