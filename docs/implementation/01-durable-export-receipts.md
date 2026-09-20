# Implementation 01 — Durable authorized-export receipts

Status: implemented and locally verified; live Cloudflare/provider certification pending.
Dependency: merged PR #2 foundation. Owners: [C02 source installation](../specs/commerce/02-source-installation-and-sdk.md), [C06 durable ingestion](../specs/commerce/06-ingestion-replay-publication.md), [C22 privacy](../specs/commerce/22-security-privacy-and-data-rights.md). Delivery order remains [C27](../specs/commerce/27-delivery-plan-and-decision-gates.md).

## Outcome and exact boundary

A licensed tenant owner can submit a bounded, explicitly authorized JSON export to a reviewed connection. Successful acceptance means the exact UTF-8 `rawJson` bytes are in private R2 and a durable receipt plus outbox row are committed in tenant D1. It does **not** mean the contents were normalized, reconciled, complete, current, correct, published, or verified against a live provider.

This is not a Nhanh/Haravan/Shopee API adapter. The registry's provider/account labels and export's schema fingerprint are declared/reviewed metadata, not a live token identity proof or row-level source certification. A later normalizer must independently validate embedded account/resource identity and quarantine mismatches before publication. The receipt path never executes instructions, scripts or SQL embedded in raw JSON.

## API

`POST /api/tenants/{tenant}/commerce-receipts` and owner-only metadata reads at `GET /api/tenants/{tenant}/commerce-receipts[/{receiptId}]` use the existing Access/membership/route/`data.import` authorization. Viewers, editors and platform operators without owner membership do not receive a new finance-access path. GET returns at most 50 newest receipts; pagination is not yet implemented.

Example synthetic body:

```json
{
  "connectionId": "orders-export",
  "sourceAccountId": "shop-A",
  "resourceType": "orders",
  "deliveryId": "unique-export-delivery-1",
  "sourceObjectId": "export-1",
  "sourceRevision": null,
  "sourceEventAt": null,
  "sourceUpdatedAt": null,
  "window": {
    "from": "2026-09-01T00:00:00.000Z",
    "toExclusive": "2026-09-02T00:00:00.000Z"
  },
  "schemaFingerprint": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "rawJson": "{\"orders\":[{\"id\":\"synthetic-1\",\"total\":\"100000\"}]}"
}
```

The example fingerprint is synthetic, not a real vendor schema hash. Instants require canonical UTC millisecond format. The interval is lower-inclusive/upper-exclusive, nonempty and at most 366 days: a local **export admission** cap, not any vendor API lookback promise. Raw JSON must be an object/array and at most 48,000 UTF-8 bytes; the enclosing HTTP JSON is also limited to 65,536 bytes. No compression or auth headers are imported. The API rejects unknown envelope keys.

New acceptance returns `202` with `state: ACCEPTED`, `normalizedRevision: null`, `publishedVersion: null`, `sourceCompletenessCertified: false`, and `liveProviderVerified: false`. Identical replay returns `200`/`replayed: true`; changed bytes or metadata under the same delivery ID return `409 DELIVERY_ID_CONFLICT`. Changing delivery IDs creates distinct raw receipts even for identical values; business-entity deduplication belongs to C07, not content-hash deduplication.

## Source approval and migration

Apply additive tenant migration `0003_commerce_receipts.sql` to every intended serving database before rollout. It does not create source connections. An authorized operator must review export ownership, scope, retention and approval evidence before provisioning `commerce_connections` in that **tenant's** database. No grants, credentials or real source data are seeded by production code.

One connection binds an immutable tenant/provider/source account/resource/transport tuple. Supported transport is only `authorized-export`. Resources are `orders`, `settlements`, `inventory`; provider labels are `nhanh`, `haravan`, `shopee`, `generic`. A different identity/resource requires a new connection rather than rewriting history. State/approval changes must increment `revision`; existing receipts keep their original approval envelope. Credential refresh is outside this export-only transport and must not be implemented by silently replacing identity.

D1 stores control metadata, source identity references and immutable receipt envelopes here; **never credentials**. Raw business payload stays in private source R2. Metadata reads expose no raw bytes, object URLs, approval records or source business rows. A declared schema fingerprint is evidence supplied by the uploader, not a quality certificate.

## Durability and concurrency

Receipt identity hashes `(tenant, connection, deliveryId)`. The R2 key also includes the server-computed raw-content hash, preventing a losing conflicting writer from overwriting the winner's evidence. The semantic-envelope fingerprint excludes server receipt time so retry does not manufacture a new event.

Write raw first, then transactionally insert receipt and outbox. Conditional receipt insertion checks active connection revision and current tenant route epoch **inside the transaction**, after the R2 await. Connection/route changes during upload leave only an unacknowledged orphan, not an admitted receipt. Duplicate writers converge through a unique tenant/connection/delivery constraint. Immutable-evidence triggers prevent in-place rewrites. State transitions and retained-evidence deletion need separately reviewed lifecycle code.

R2 and D1 are not one transaction. A crash before D1 can leave an orphan; retry adopts the deterministic object key. Conflicting concurrent deliveries can leave an unreferenced object. Automated orphan collection and privacy deletion are not implemented; keep raw retention conservative until a reference-aware, age-bounded sweeper exists. A persistent receipt depends on retained R2 evidence; a normalizer must verify hash/object existence before consumption.

## Outbox: implemented adapter, undeployed transport

`dispatchCommerceOutbox(ctx, send, limit)` reads at most 50 pending references, rechecks scope/epoch on each send, counts attempts, sends only `{tenantId, connectionId, receiptId}`, and marks dispatched **after** successful send. Send failures leave pending rows. A crash after send/before mark can send the same reference again: this is explicitly at-least-once. Do not claim exactly-once source or business processing.

No Queue binding, cron, normalization consumer, lease coordinator, retry scheduler or DLQ recovery is deployed by this slice. The injectable adapter is tested with deterministic send/failure behavior. A production consumer must independently revalidate tenant routing, connection/coverage state, receipt identity, retained object hash and pinned normalizer version; dedupe processing by receipt revision. Dispatching a receipt is not normalizing it. Expired delivered messages require a reconciliation/resend policy before a production recovery claim.

## Executable evidence

`tests/commerce-receipts.test.mjs` adds 20 tests; the total backend suite is 111. They exercise real SQLite transactions and API authorization, byte bounds, privacy-safe metadata, concurrent identical/conflicting deliveries, immutable evidence, source/route revocation during upload, R2 failure, receipt/outbox rollback, retry adoption, no-facts publication, outbox failure/recovery, send/mark crash redelivery and between-send revocation.

C06-A01's crash boundary is exercised; C06-A02's durable dispatch boundary is exercised, but its complete logical processing claim awaits the normalizer/consumer. C02-A01 is only envelope/registry identity denial here, **not live token verification**. C06-A03/A04 canonical equivalence/quarantine, A05/A06 publication fencing/atomic manifests and A07 prolonged-outage recovery are still open. Unknown valid JSON is retained unnormalized, not silently treated as a verified schema.

## Next dependency-ordered slice

Implement a pinned export normalizer into staged C07 canonical identities, source-authority mapping and cross-OMS/marketplace deduplication, consuming retained receipt evidence. Then add C08 reconciliation and C09 money definitions with null costs/fees and historical COGS. Only a verified immutable publication may drive the first Money Truth decision card. Obtain real Nhanh authorization and a merchant's closed-period source controls in parallel; no amount of synthetic tests substitutes for those gates.

## Snapshot event semantics (PR #4 review)

This authorized-export transport is snapshot-only. `eventType` may be omitted for existing callers or explicitly be `snapshot`; the parser always records `eventType: snapshot` in the immutable, fingerprinted envelope. `upsert`, `delete`, `correction` and unknown event types are rejected before R2. Snapshot scope is exactly the declared account/resource/window, not permission to erase an entire tenant. A later normalizer must validate that scope and completeness before applying a replacement. Receipts captured by earlier code without event semantics are not silently reinterpreted: they require a reviewed re-import under a new delivery ID before normalization.
