# Implementation 07 — Durable bounded commerce jobs

Status: implemented bounded tenant-D1 admission and manual lease consumer; live
Cloudflare Queue, DLQ, worker-restart and prolonged-outage certification pending.
Canonical owners: [C06 ingestion](../specs/commerce/06-ingestion-replay-publication.md),
[C22 privacy](../specs/commerce/22-security-privacy-and-data-rights.md),
[C23 operations](../specs/commerce/23-cloudflare-operations-and-scale.md) and
[C25 API compatibility](../specs/commerce/25-api-events-and-extension-boundary.md).

## Outcome and boundary

An accepted raw receipt can be admitted to a durable, tenant-scoped normalization
job. Admission does not publish data. A bounded owner-triggered execution acquires
a lease, revalidates the current source and route fence, consumes the existing
normalizer, and records retry or terminal state without exposing raw evidence.

This is a local/runtime job boundary, not a deployed Queue consumer. The current
cell has no Queue binding, service-principal consumer authentication, cron sweep,
dead-letter transport or Cloudflare recovery rehearsal. The manual execution route
exists to make the state machine and failure cases executable while those external
prerequisites remain open.

## API

All routes are under `/api/tenants/{tenant}` and require the independently
authorized tenant owner plus the `data.import` entitlement.

- `POST /commerce-jobs` with `{ "receiptId": "cr_..." }` returns `202` and a
  durable job ID. The public states are `QUEUED`, `RUNNING`, `RETRY_PENDING`,
  `SUCCEEDED`, `FAILED` and `CANCELLED`; `PENDING`, `COMPLETED` and
  `DEAD_LETTERED` remain storage states.
- `GET /commerce-jobs` returns at most 50 tenant-scoped metadata rows.
- `GET /commerce-jobs/{jobId}` returns one tenant-scoped metadata row.
- `POST /commerce-jobs/{jobId}` is the bounded manual execution trigger. It is
  not evidence of Queue delivery, provider polling or production scheduling.

No endpoint returns raw receipt bytes, object references, credentials, query text or
source rows. Errors retain stable classified codes only.

## Safety and recovery invariants

- Admission rechecks active connection state, immutable connection revision, receipt
  state and tenant route epoch. A paused/revoked or stale receipt cannot create a
  job.
- The ten-job active admission cap is enforced inside the same D1 batch as the
  insert. A unique tenant/kind/receipt key makes replay return the original job,
  including when the tenant is otherwise at capacity.
- Execution uses a cryptographic lease token and a 60-second lease. At most three
  attempts are admitted; an expired final lease is fenced into `FAILED` rather than
  remaining `RUNNING` forever.
- The consumer checks the current connection and route again before claiming work.
  Source revocation or a scope race leaves the job `RETRY_PENDING` with a stable
  reason and never authorizes access through the queued identifier.
- The receipt checkpoint is advanced separately from the job state. The normalizer
  preserves raw evidence, creates an immutable normalized revision, and quarantines
  unsupported business data; a successful job is not a published report.
- Retryable infrastructure failures return to `RETRY_PENDING`; integrity, identity,
  lease and scope failures do not loop indefinitely. Raw/driver details are not
  copied into `lastError`.

## Evidence and remaining gates

`tests/commerce-jobs.test.mjs` exercises the real local SQLite adapter and API
authorization for twelve cases: normalizer handoff, role/tenant/resource denial,
bounded and concurrent admission, idempotent replay at capacity, source-scope
recheck, lease contention, retry exhaustion, expired final-lease recovery, source
revocation after admission and revoked-receipt denial. This is fixture/runtime
evidence only; it is not workerd, authenticated Cloudflare, provider or merchant
evidence.

The remaining C06/C23 gates are a service-authenticated Queue binding, opaque
reference dispatch, independent consumer reauthorization, fair provider-key
scheduling, DLQ/replay policy, queue-retention expiry, deletion-ledger checks,
worker restart recovery, measured load/fairness and one-tenant restore. Do not mark
C06-A02/A07 or C23-A01/A04 complete from this implementation alone.

## Platform reference

Reviewed 2026-09-20: D1 `batch()` is transactional and D1 Sessions supports
`withSession("first-primary")`; Cloudflare Queue consumers explicitly acknowledge
or retry messages and can be configured with bounded batches, retries and a DLQ.
The repository still needs an authenticated service boundary before adding those
bindings to the production cell configuration.

- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/queues/configuration/batching-retries/
- https://developers.cloudflare.com/queues/configuration/configure-queues/
