# C05 — Shopee Open Platform connector and access gate

Spec: C05 | Status: Target contract; API access blocked/unverified in this review | Stage: P0 access discovery; P1 certification

Owns: Shopee-specific access, protocol and finance/logistics semantics. Does not own scraping or unofficial quota/auth inventions.

## Evidence boundary

The official Open Platform entry point returned HTTP 403 in this research environment on 2026-09-20. Existing strategy names V2 order/product resources but does not establish current authenticated quotas, token lifetimes, history windows, push verification or settlement/returns access for Lumi's app. Treat those facts as **unknown**, not missing prose to fill from memory. [S1](../research/sources.md#s1)

The production connector is gated on authorized partner/app documentation and test merchant grants. A working community SDK is not approval to use an endpoint or access every financial field. No fixed 15-day window, token duration or universal rate limit is hardcoded by this spec.

## Contract

- **C05-R01:** access discovery produces an app/region/capability matrix: app registration/review state, permitted business model, shop authorization, resource scopes, signing/token rules, quota key, pagination, historical availability, deletion/masking rules and push delivery contract.
- **C05-R02:** independently certify orders/lines, listing/model catalog, inventory, logistics/fulfillments, returns/refunds and payment/escrow/settlements. Success of the orders API cannot advertise a full margin/settlement product.
- **C05-R03:** app secrets, refresh/access tokens and shop binding are tenant-scoped through C22. Refresh races are serialized per credential version; late refresh results cannot overwrite newer tokens. Revocation halts new reads/actions and surfaces incomplete freshness.
- **C05-R04:** preserve shop ID, order serial/ID, item ID, model/variant ID, package/shipment ID, return/refund ID, payout/statement reference and adjustment identity as separate source keys. Seller SKU strings are labels, not reliable global identity.
- **C05-R05:** a Shopee order mirrored in Nhanh/Haravan remains one commerce order with multiple source observations (C07). Direct marketplace records can govern marketplace status/fees while OMS governs local fulfillment/warehouse activity. Conflicts remain reviewable.
- **C05-R06:** distinguish order eligibility for payout, escrow estimate, final statement allocation and bank receipt. An escrow/net-income API field is not automatically realized cash in a bank account.

## Merchant value and minimum scope

First prove one shop's order identities and one closed payout period. Read recent/updated orders, product models and logistics only to the extent officially allowed. Settlement sources may be authorized merchant exports before direct finance API is approved. Export mode is displayed as such, with its capture date and completeness limitations.

Push notifications are invalidation hints until the event's authentication, ordering, duplication and payload completeness are established. Reconciliation re-fetches affected objects or windows and marks expired history gaps as nonrecoverable from API. Partition backfills according to the **documented installed capability**, not a copied magic constant.

Buyer identities may be masked, missing or restricted. Cross-channel identity resolution and CRM actions remain off unless an independently lawful and reliable identity path exists. Never undo marketplace privacy masking by linking fuzzy names or searching external data.

## Financial normalization checklist

Require field-level examples for buyer payment, seller-funded discount, platform-funded subsidy, shipping charged to buyer, seller shipping expense, commission/service/payment/affiliate fees, refunds, reversals, reserve movements and withholding categories. Unknown fee labels retain provider code/raw amount and block final margin classification; they are not silently mapped to commission.

Check whether per-order detail is provisional, final or later adjusted; whether statement amounts include fees already deducted from another field; and how negative/post-period adjustments link to original orders. Manual control totals remain an independent reconciliation input.

## Access release artifact

Store an access-contract record with source URL/document revision, retrieval date, app region, verified scopes, fixture hashes and owner signoff. Restricted documentation and customer fixtures live in controlled evidence storage, not public Git. Code comments may reference evidence IDs.

## Acceptance

- **C05-A01:** absent partner authorization leaves the connector `BLOCKED_APPROVAL`, not a fake active demo or silent browser scraper.
- **C05-A02:** order access granted but settlement access denied: sales works with proper evidence; settlement confidence remains unavailable/partial.
- **C05-A03:** the same order through direct Shopee and an OMS yields one business order and two traceable observations.
- **C05-A04:** fee adjustment after a payout close produces a new restatement/version and an investigation; it does not rewrite a previously delivered report invisibly.
- **C05-A05:** masked buyer fields never yield an invented identifiable customer.
- **C05-A06:** token refresh and two concurrent sync workers preserve the latest credential/checkpoint generation.
- **C05-A07:** API and file sources overlap without duplicate financial events; unresolved overlap blocks a certified total.
