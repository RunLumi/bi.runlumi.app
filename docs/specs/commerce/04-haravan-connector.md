# C04 — Haravan connector

Spec: C04 | Status: Target contract; official docs reviewed, live merchant certification pending | Stage: P0 schema spike, P1 certified connector

Owns: Haravan installation, reads, event handling and conformance. C06 owns delivery machinery; C07 owns canonical interpretation.

## Verified surface

Haravan Commerce APIs expose scoped orders, transactions, products/variants, customers and inventory resources. `com.read_orders`, `com.read_products`, `com.read_inventories` and only necessary customer scopes are requested; write scopes are not needed for BI. The documented installation flow distinguishes user tokens from long-lived `grant_service` installation access; webhook scope `wh_api` requires the eligible shop owner/app setup. Token validity is still monitored; long-lived does not mean irrevocable. [H1](../research/sources.md#h1)

Rate control uses a leaky bucket; documented defaults are capacity 80, refill 4/second, with usage headers and retry handling. These are adapter defaults to validate against the installed app and current documentation, not promised throughput. [H2](../research/sources.md#h2)

Orders are read via `/com/orders.json` and object/count resources. POS orders can lack a customer. Financial and fulfillment statuses are separate; neither alone establishes a bank receipt. Events provide incremental enumeration including `since_id`. [H3/H4](../research/sources.md)

## Contract

- **C04-R01:** verify merchant organization/shop identity after installation and before backfill. Validate token signatures/audience/issuer where identity tokens are used, not merely decode JWT text from a documentation example.
- **C04-R02:** endpoint/filter behavior is certified per resource. Never apply Shopify pagination/webhook assumptions to Haravan because payloads look familiar.
- **C04-R03:** use Events plus incremental reads as recovery mechanisms, but test which entity changes are covered, event retention, deletion behavior and nested refund changes. Events are not a transaction log with guaranteed complete retention.
- **C04-R04:** re-fetch authoritative objects when notifications are thin or out of order. Credentials and source rate budget are shared correctly between poll, backfill and events workers.
- **C04-R05:** before enabling webhooks, capture and test the official verification algorithm/header, raw-body requirements, retry behavior and topic coverage. These details are a release blocker if not independently verified; no copied Shopify HMAC implementation is accepted as evidence.
- **C04-R06:** preserve nested refunds, transactions and fulfillments at their own grain, not repeated sums on order rows. Inventory locations and sales channels remain distinct.

## Mapping requirements

Map order ID, line ID, variant ID, location, source/channel reference, created/updated timestamps, cancellation status, financial status, fulfillment status, discount/price/tax values and available refund/transaction references. Unknown enum values are retained and quarantined where classification matters. Null customer is valid; no synthetic customer shared across all anonymous orders.

Do not trust cumulative customer `total_spent` as an additive fact. Do not infer payment completion from manually assignable order financial state when the decision requires independently observed settlement. Tax-inclusive/exclusive values require per-field evidence and fixture checks, not a guessed global conversion.

Inventory P0 scope is current stock only after coverage certification. Historical stock and cost layers require movement/history sources or snapshots captured prospectively. Supplier purchase resources are read-only future capabilities until verified.

## Backfill and update behavior

Pin request filters, ordering and cursor semantics in connector metadata. Establish bounded overlapping updated windows if supported; otherwise enumerate IDs/events with periodic reconciliation. Store explicit requested status filters: a default excluding closed/cancelled orders cannot back a complete sales claim. Changes older than the latest create ID must still be detected.

A missing webhook topic degrades latency, not truth: polling/reconciliation may support a published lower-freshness tier. Incomplete historical source access cannot be hidden behind a full-period chart.

## Acceptance

- **C04-A01:** a non-owner user who cannot grant installation scope receives a clear authorization path, not an active connection with incomplete permissions.
- **C04-A02:** same monetary order fixture maps identically through Haravan and Nhanh where business semantics match; provider-specific differences remain explicit.
- **C04-A03:** anonymous POS orders are counted correctly without fabricated customer retention.
- **C04-A04:** old order receives partial refund after the create cursor advances; the incremental/reconciliation path discovers it.
- **C04-A05:** a second fulfillment or transaction does not multiply the order amount in downstream joins.
- **C04-A06:** rate-limit saturation backs off while preserving checkpoints; no source is marked current until recovery catches up.
- **C04-A07:** webhook verification and deletion coverage are marked unverified until tests from an authorized installation pass.
