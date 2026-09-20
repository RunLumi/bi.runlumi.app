# C03 — Nhanh.vn connector

Spec: C03 | Status: Target contract; official docs reviewed, live credentials not tested | Stage: P0

Owns: Nhanh V3 protocol decisions, mapping evidence and certification. Generic durability is C06; commerce identities are C07.

## Verified constraints and conflicts

Use V3, not a new V2 implementation. Official V3 introduction describes POST JSON requests, `appId`/`businessId`, Authorization access token, opaque `paginator.next`, default page size ceiling 100 and quota 150 requests/30 seconds keyed by app/business/API URL unless endpoint rules differ. Persist and honor provider throttle details rather than rotate apps to evade them. [N1](../research/sources.md#n1)

Order list windows are at most **31 days per request**; created, updated and delivery dates have different semantics. Older history is requested through bounded historical windows. This is not a 31-day retention claim. [N2](../research/sources.md#n2)

Product update timestamps explicitly exclude stock changes. Inventory docs also contain contradictory wording about their own updated-time behavior. Treat this as an unresolved provider contract and test it with a stock-only mutation; do not assume product polling keeps inventory current. [N3/N4](../research/sources.md)

V3 webhook docs specify a configured verify token in Authorization, while a generic app page describes a body token. Use the **version-specific verified contract** and fixture; do not accept both opportunistically. Webhooks do not backfill pre-install history. [N5](../research/sources.md#n5)

## Contract

- **C03-R01:** endpoints initially cover `/v3.0/order/list`, `/v3.0/product/list`, `/v3.0/product/inventory` and minimum customer references needed for permitted analysis. Base host and method are pinned in the adapter; no URL from payload is followed.
- **C03-R02:** split historical/incremental order windows according to confirmed provider inclusivity. Persist the returned cursor intact; a short page with a non-null next cursor is not EOF. Detect repeated cursors and window non-progress.
- **C03-R03:** synchronize product metadata and inventory separately. Use inventory webhooks plus scheduled scope-complete inventory reconciliation until stock-only timestamp behavior is certified.
- **C03-R04:** authenticate the webhook with the V3 contract, then map verified app/business to the installed tenant. A body businessId is a routing hint inside that verified association, not permission to select arbitrary tenant data.
- **C03-R05:** acknowledge only after durable raw acceptance under C06. For Nhanh return the documented success status; errors, redirects and slow callbacks are monitored because provider retries are finite.
- **C03-R06:** normalize order/product/inventory changes and deletion signals without treating missing rows as deleted. Preserve partial-return linkage to original order; do not count it as a fresh sale. The official order webhook includes `orderPartialReturn`. [N6](../research/sources.md#n6)

## Incremental algorithm

Capture upper cutoff; request updated window with bounded overlap; persist every page to raw storage; write durable receipt/checkpoint; normalize idempotently; reconcile affected IDs; publish a validated data version. Source version/order resolves stale retries; ingestion arrival order does not. Deleted IDs produce tombstones and recomputation, not erased lineage.

Quota coordination groups by the actual documented app/business/endpoint key, including parallel backfill and retry consumers. `ERR_429`/unlock time suspends that key while unrelated connections proceed fairly. Transport 200 with provider-level error is not success.

## Financial and inventory limitations

Expose source cost fields as observations. Until cost-at-sale meaning is verified, do not label current import/average cost as historical COGS. Depot visibility is part of coverage. A marketplace order mirrored into Nhanh links to marketplace IDs where present, but Nhanh does not automatically become authority for Shopee's final payout/fees.

Missing settlement, historical inventory or return details remain capability gaps. File supplements use C02. Do not invent exact payout/fee endpoints from wrappers.

## Certification evidence

Save redacted/synthetic fixtures for a normal sale, stock-only update, old-order update, duplicate delivery, partial return, deleted order, restricted depot token, expired token and throttle response. Record app version, account permissions, endpoint request shape and response schema version without secrets. Live merchant evidence is stored privately, not committed.

## Acceptance

- **C03-A01:** backfill a period longer than 31 days with adjacent windows; boundary orders appear once and coverage is explicit.
- **C03-A02:** short page + valid next cursor continues; repeated cursor stops safely and raises a source defect.
- **C03-A03:** stock changes without product metadata change reach the published inventory; failing this blocks inventory certification.
- **C03-A04:** a V2-style token location is rejected on a V3 webhook endpoint unless an explicitly separate versioned adapter is configured.
- **C03-A05:** duplicate and delayed webhook delivery does not duplicate revenue or roll state backward.
- **C03-A06:** partial return retains original-order association and does not create an additional sale.
- **C03-A07:** depot scope shrinks after reauthorization: affected stock queries become partial/unavailable instead of silently lower.
