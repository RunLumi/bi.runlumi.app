# Primary-source register

Review date: **2026-09-20**. This is a source/evidence register, not a guarantee APIs or commercial access will remain unchanged. Public documentation was inspected through direct pages or official-domain search text. No merchant credentials, private Shopee API documents or live order/finance tests were available for this specification update.

A documented capability is not a certified integration. Before adapter release, capture the applicable document revision, installed app/region/scopes, sanitized fixture hashes and authenticated test results. Keep restricted documents/customer evidence outside public Git. `STRATEGY.md` is an existing research synthesis, not a substitute for current protocol evidence. Historical chat-style citation tokens in that file are not reused as references here.

## Nhanh.vn

### N1

**V3 introduction and common protocol.** [Official documentation](https://apidocs.nhanh.vn/v3). Status: official documentation observed; live contract pending. Supports POST/JSON, app/business identity, Authorization token, provider pagination and quota semantics. Documented default is 150 calls per 30 seconds by app/business/API URL unless endpoint overrides apply. Use returned opaque next cursor and detect no-progress loops. Adapter quotas must remain configurable and honor server throttle state.

### N2

**Order list.** [Official documentation](https://apidocs.nhanh.vn/v3/order/list). Status: documented. Maximum 31-day query windows must not be described as a 31-day history retention limit. Created/updated/delivery filters have different meanings. Live inclusivity, large history and late-update behavior require fixtures.

### N3

**Product list.** [Official documentation](https://apidocs.nhanh.vn/v3/product/list). Status: documented. Product metadata update timestamps exclude inventory-only changes. A product metadata poll cannot establish complete inventory freshness.

### N4

**Inventory.** [Official documentation](https://apidocs.nhanh.vn/v3/product/inventory). Status: **conflicting documentation / release gate**. Inventory update-filter wording is internally inconsistent with a note about product updates and quantity. Certify with a stock-only mutation and token warehouse-scope test. Until resolved, inventory webhook plus periodic reconciliation is required and timestamp coverage is not assumed.

### N5

**V3 webhook contract.** [Official documentation](https://apidocs.nhanh.vn/v3/webhooks/webhooks). Status: documented version-specific contract. Describes HTTPS POST, success HTTP 200, verify token in Authorization, finite retries and no historical replay before installation/enablement. Generic [app documentation](https://apidocs.nhanh.vn/app) describes a different token placement; do not broaden acceptance to both without explicit version isolation and certification. Repeated callback failures can lead to provider-side restriction, so durable quick acceptance and recovery matter.

### N6

**Order webhook entities.** [Official documentation](https://apidocs.nhanh.vn/v3/webhooks/order). Status: documented. Order add/update/delete and partial-return events require separate normalization. Source marketplace/order references can support explicit identity linkage but must be verified on the installed merchant payloads.

## Haravan

### H1

**Access scopes and installation.** [Official documentation](https://docs.haravan.com/docs/omni-apis/access-scopes/). Status: documented; live installation pending. Commerce read scopes, long-lived installation flow via grant_service and webhook scope wh_api are distinct from a normal user login. Request the minimum resources; owner/app eligibility must be tested. Do not merely decode identity tokens without signature/audience validation.

### H2

**API rate limiting.** [Official documentation](https://docs.haravan.com/docs/omni-apis/api-call-limit/). Status: documented. The public default leaky bucket is capacity 80 with refill 4/second; response usage and retry headers are operational authority. This does not establish every app/resource's guaranteed throughput.

### H3

**Orders.** [Official documentation](https://docs.haravan.com/docs/omni-apis/orders/). Status: documented. Orders, nested lines, financial/fulfillment fields and nullable POS customer identity inform the canonical model. Exact field tax/discount/cost and late-refund behavior remain certification tasks.

### H4

**Events.** [Official documentation](https://docs.haravan.com/docs/omni-apis/event/). Status: documented. Incremental event enumeration, including since_id, is useful for recovery. It does not prove complete CDC retention or coverage of every nested/deleted resource. Webhook authenticity and event retention remain explicit open questions.

## Shopee

### S1

**Open Platform.** [Official entry point](https://open.shopee.com/). Status: **ACCESS_BLOCKED**; direct access returned HTTP 403 in this review environment. No authenticated provider contract was obtained. App approval, region/shop grant, signing, refresh, quotas, historical windows, push verification, returns and settlement coverage remain unverified.

Official endpoint names mentioned by earlier strategy are discovery leads, not release evidence. Do not infer a current production contract from community SDKs. Obtain authorized partner documentation and a test shop, or explicitly use merchant-authorized exports as a different source mode.

## Databricks: principles to transfer, not an implementation dependency

### D1

**Medallion architecture.** [Official documentation](https://docs.databricks.com/aws/en/lakehouse/medallion). Raw retention, validated conformed data and business-ready aggregates motivate Lumi's separation of evidence, canonical revisions and serving metrics. The pattern does not give R2 and D1 a shared ACID transaction.

### D2

**Unity Catalog lineage.** [Official documentation](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage). Lineage/impact information is useful only with access controls. Lumi records explicit transformation/query/evidence edges rather than claiming full automatic lineage across arbitrary SQL and external systems.

### D3

**Pipeline expectations.** [Official documentation](https://docs.databricks.com/aws/en/ldp/expectations). Named quality predicates and action/metric reporting inform C08. Lumi deliberately quarantines financially meaningful invalid rows rather than silently dropping them to make a job green.

### D4

**Governed metrics.** [Official metric-view management](https://docs.databricks.com/aws/en/uc-semantics/metric-views/manage) and [semantic concepts](https://docs.databricks.com/gcp/en/uc-semantics). Central definitions and governed consumption inform C09. Lumi does not need to recreate the complete metric-view language or Databricks SQL engine.

### D5

**AI/BI natural-language analytics.** [Official setup documentation](https://docs.databricks.com/aws/en/genie-agents/set-up). Curated context, approved assets and permission-aware analytics inform Ask Lumi. Product naming and feature availability can change; the transferable principle is constrained, evaluated analytical answers, not a claim of feature parity.

### D6

**Certification and deprecation.** [Official documentation](https://docs.databricks.com/gcp/en/data-governance/unity-catalog/certify-deprecate-data). Governed lifecycle states inform metric/pack publication. Lumi's certification refers to its stated test/source scope, not a third-party compliance certificate.

## Cloudflare

### F1

**D1 limits and recovery.** [Official limits](https://developers.cloudflare.com/d1/platform/limits/). At review: paid per-database storage limit 10 GB; many small databases per account are supported; database execution/query/resource limits matter. Time Travel retention on paid plans is documented as 30 days. These do not establish cross-product recovery or guarantee suitability for arbitrary OLAP. Verify current account quotas, bindings and SQL limits before deployment.

### F2

**Queue delivery.** [Official delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/). At-least-once delivery requires idempotent consumer effects; duplicate transport is expected behavior, not exceptional corruption.

### F3

**Queue processing.** [Official behavior](https://developers.cloudflare.com/queues/reference/how-queues-works/). Do not infer ordered delivery. Workflow/entity sequencing and stale-update rejection belong in application contracts.

### F4

**Dead-letter queues.** [Official configuration](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/). Retry and retention limits mean a Queue/DLQ is not an indefinite raw archive. Durable source receipts, outbox repair and replay must survive message expiry.

### F5

**R2 SQL.** [Official overview](https://developers.cloudflare.com/r2-sql/). Status at review: open beta. SQL over Iceberg tables in R2 Data Catalog is a candidate analytical exit, not the default critical-path warehouse for the first paid merchant. Verify required SQL features, auth and recovery before adoption.

### F6

**Workers Static Assets.** [Official documentation](https://developers.cloudflare.com/workers/static-assets/). Workers can serve application assets and API behavior in one deployment. The choice simplifies this product's origin/routing; it does not require migrating unrelated Lumi Pages sites.

### F7

**AI Gateway logs.** [Official logging documentation](https://developers.cloudflare.com/ai-gateway/observability/logging/). Request/response payload logging is enabled by default. The documented cf-aig-collect-log-payload control can retain metadata without payloads; cf-aig-collect-log disables the whole entry. Enforce server-side policy and verify actual logs. BYOK or a gateway does not itself guarantee tenant privacy.

### F8

**Workflows.** [Official overview](https://developers.cloudflare.com/workflows/). Durable step coordination is useful for backfill/recovery. Workflows do not override provider quota, database, CPU/memory or business idempotency limits.

## Verification policy

Repository reference review is not background monitoring. Assign connector owners to recheck relevant official change logs before each release and when a contract error appears. Changed facts trigger tests and a versioned decision, not automatic feature copying. Commercial prices, Vietnam legal applicability and platform terms must be reverified when making an actual offer/deployment; this suite intentionally avoids unverified legal deadlines and market-size/price claims.
