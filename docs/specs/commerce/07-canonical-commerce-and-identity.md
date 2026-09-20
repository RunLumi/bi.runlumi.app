# C07 — Canonical commerce model and source authority

Spec: C07 | Status: Target contract | Stage: P0 core, P1 finance/stock depth, P2 portfolio

Owns: entity identity, fact grains, temporal revisions and cross-source authority. Excludes: aggregate formulas (C09), transport dedupe (C06), legal customer-identity permission (C22).

## Outcome

One purchase seen in Shopee and an OMS is one business order with two observations—not two sales and not one flattened record that loses the disagreement. A physical stock pool advertised on three channels is still one stock pool.

## Identity contract

- **C07-R01:** source identity key is `(tenant_id, provider, source_account/shop_id, resource_type, source_object_id)`. IDs are opaque strings; numeric-looking IDs must not round through JavaScript Number. Connection/token rotation is not entity identity.
- **C07-R02:** canonical IDs are stable generated IDs. `SourceObjectLink` records links from source objects to canonical entities, evidence, mapping version, confidence class and validity interval. Reinstallation does not create a second business object.
- **C07-R03:** identity matching hierarchy: explicit platform/OMS cross-reference → reviewed deterministic mapping → suggested match requiring review. Same SKU text, buyer phone, amount or timestamp alone cannot auto-merge orders/customers across shops.
- **C07-R04:** field-level authority is configured by resource and purpose. Marketplace governs its settlement; OMS may govern warehouse work; cost ledger governs effective cost. Contradictions become cases, never arbitrary last-arrival-wins.
- **C07-R05:** raw enums and original identifiers survive mapping. Canonical unknown states remain unknown; no unknown status is treated as completed or paid.

## Minimum grains

| Entity/fact | Grain and critical identity | Anti-join rule |
|---|---|---|
| LegalEntity/Store/ChannelAccount | one entity/store/platform account | Store and warehouse are not interchangeable |
| Product/Variant/Listing | merchant SKU versus channel listing/model | Same SKU string is not a global key |
| SKU mapping/BOM | source variant→canonical variant; effective-dated components | Bundle parent and components cannot both count sales |
| Order | one business purchase | Never aggregate mirrored copies |
| OrderLine | one source/canonical line, stable across revisions | Quantity is not an order count |
| OrderStateEvent | one observed business transition | Events are not additional orders |
| DiscountAllocation | funding party × source allocation × line | Seller and platform funding remain separate |
| Fulfillment/ShipmentLine | shipment/package × order line × quantity | Joining two shipments cannot double order revenue |
| ReturnLine | return ID × original line × quantity | Return, refund and restock are separate effects |
| RefundTransaction | refund event/currency/component | Do not subtract refund and returned quantity twice |
| FinancialEntry | one fee/receipt/adjustment/reserve event | Classify sign, component and provisional/final state |
| Settlement/Allocation | payout/statement × allocated financial entry | One payout may include many orders/periods |
| BankReceipt/Match | observed receipt × allocation | Matching is not creating a new receipt |
| InventorySnapshot | stock pool × variant × observed instant | Snapshot is a gauge, not a movement |
| InventoryMovement | uniquely identified movement line | Transfer out/in represent one transfer, not sales |
| CostLayer | variant/location × effective interval/batch | Current cost cannot rewrite historical sales |
| PurchaseOrder/ReceiptLine | supplier PO line/receipt | Planned inbound is not received inventory |
| CustomerIdentityLink | permitted source identities plus reviewed links | Anonymous and masked buyers remain unresolved |
| AdSpend | account/campaign × date/currency | Do not fan out spend across order joins |

P0 can implement the subset required for Money Truth and current inventory. Future fields do not justify empty generic tables for every domain.

## Bitemporal-lite model

Retain source event time, source updated time, observed/ingested time, canonical revision time and publication version. A canonical revision carries `valid_from/valid_to` where business-effective history matters, plus `recorded_at`. Query supports `as_known_at` through retained manifests. A late refund may affect today's adjustment view and restate an old order cohort; these are different perspectives selected by metric definition.

Track business status axes independently: commercial acceptance, fulfillment, payment, return, settlement. A single status rank cannot represent them. A cancellation may occur after partial shipment; no simplistic monotonic rank resolves all transitions.

## Money, quantity and dimensions

Amounts use currency + exact scaled decimal/integer representation; serialization uses decimal strings where numeric safety requires it. Preserve original source precision and rounding residual. Quantities may be fractional with units; units-per-pack conversions are effective-dated. Warehouse stock categories (on-hand, reserved, damaged, shipping, available) preserve source semantics before canonical derivation.

Addresses keep source text and historical codes. Localization or changing administrative reference data must not rewrite historical location meaning. Named marketing campaigns, salary and PII are optional domain fields, not globally mandatory data collection.

## Source authority disputes

An `AuthorityRule` names metric purpose, source precedence, effective interval, expected scope and reviewer. When sources disagree, retain observations and resolve according to this rule; record excluded observations and rationale. Uncertain matches remain in a reconciliation queue and are excluded from certified unified totals with explicit coverage reporting. Do not silently drop them to make variance disappear.

## Acceptance

- **C07-A01:** one Shopee order mirrored into Nhanh/Haravan produces one canonical order, traceable independent field observations and no doubled sales.
- **C07-A02:** unrelated orders with identical amount/date/customer text remain distinct.
- **C07-A03:** source reconnection preserves IDs; different source shops with identical numeric IDs remain separate.
- **C07-A04:** one order with two shipments and two financial fees aggregates correctly without a many-to-many fanout.
- **C07-A05:** partial return changes return/refund/restock axes independently and references original lines.
- **C07-A06:** changing current SKU cost does not rewrite prior cost-at-sale; correction creates a versioned restatement.
- **C07-A07:** physical pool shared by listings is counted once; two genuinely distinct warehouses are counted separately.
