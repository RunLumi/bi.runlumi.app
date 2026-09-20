# ADR 0007 — Durable bounded commerce jobs before Queue deployment

Status: accepted for the bounded implementation; Queue deployment remains a gated
follow-up.

## Context

Raw receipts must not depend on a request staying alive, but the current cell has no
service-authenticated Queue consumer or production recovery environment. Adding a
publicly callable consumer or trusting `tenantId` from a message would violate the
control-plane and tenant-boundary contracts.

## Decision

Store a small, tenant-prefixed normalization job record in the serving D1. Admit it
only after owner/entitlement authorization and a current connection, receipt and
route-epoch check. Enforce the active cap transactionally, deduplicate by
tenant/kind/receipt, and execute through a cryptographic lease with a finite retry
budget. The current HTTP trigger is an owner-only manual adapter used for local and
fixture verification. Its public response maps internal storage states to the C25
job vocabulary without claiming asynchronous transport.

Do not add a Queue binding until the service-to-service identity contract, opaque
message schema, independent consumer reauthorization, per-provider fairness, DLQ
retention/deletion behavior and authenticated workerd/staging tests exist. The
future consumer must call the same lease/normalizer boundary; it must not create a
second job or metric definition.

## Consequences

The current product can prove durable admission, replay, fencing and bounded
normalization without pretending local SQLite is Cloudflare or that an owner POST is
provider scheduling. It cannot yet claim queue delivery, crash recovery after queue
retention, fair multi-tenant backfill or one-business-day restore. Those are explicit
gates rather than hidden defaults.
