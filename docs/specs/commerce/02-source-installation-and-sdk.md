# C02 — Source installation, capability discovery and connector SDK

Spec: C02 | Status: Target contract | Stage: P0–P3

Owns: installation lifecycle and provider-neutral ingestion interfaces. Excludes: protocol-specific assumptions (C03–C05), durable delivery (C06), field authority (C07).

## Outcome

A merchant knows exactly which shops, warehouses, resources and history Lumi can see before interpreting a KPI. A successful token exchange does not imply complete data or every advertised metric.

## Contract

- **C02-R01:** each connection is bound to tenant, provider, provider app/account and source business/shop identities returned by a verified installation flow. OAuth state binds initiating membership, redirect allowlist, nonce and expiry; use PKCE where the provider supports it. Never bind a shop from an untrusted callback parameter alone.
- **C02-R02:** request minimum read capabilities. An API using POST for reads is not automatically a write capability. Mutating APIs remain outside a BI token's intended use even when the vendor token is broad.
- **C02-R03:** capability state is per resource: `UNKNOWN`, `SUPPORTED`, `MISSING_SCOPE`, `UNSUPPORTED`, `BLOCKED_APPROVAL`, `DEGRADED`. Record evidence and tested date. Missing fees, costs, inventory depots or history disable dependent claims, not the whole product.
- **C02-R04:** secrets use tenant-bound references (C22). Rotation and reauthorization preserve source identity and checkpoints, while changed business/shop identity requires an explicit new binding and dedup review.
- **C02-R05:** no unofficial scraping, consumer-account password collection, quota evasion or generic computer-use fallback is an invisible substitute for unavailable partner APIs.

## Minimum interface

```ts
interface CommerceConnector {
  verifyInstallation(input: InstallProof): Promise<VerifiedSourceIdentity>;
  discoverCoverage(ctx: SourceContext): Promise<CoverageManifest>;
  readPage(ctx: SourceContext, request: ReadWindow): Promise<RawPage>;
  verifyWebhook(request: RawHttpRequest): Promise<VerifiedTrigger>;
  readObject(ctx: SourceContext, ref: ProviderObjectRef): Promise<RawEnvelope>;
  reconcileWindow(ctx: SourceContext, window: ReadWindow): Promise<SourceControl>;
  normalize(envelope: RawEnvelope, version: string): CanonicalChange[];
}
```

These are target interfaces, not an installed SDK. Credentials are resolved inside SourceContext's trusted transport, never passed to a normalizer or model. Vendor pagination cursors are opaque serializable values. ReadWindow expresses object type, time semantics, lower/upper bounds and scope. RawPage includes cursor, object count, observed headers, source query identity and completeness evidence.

## CoverageManifest

Include accessible legal entities/shops/warehouses; resource capabilities; earliest verified history by object; source timezone; identifier namespaces; fields masked/absent; webhook topics and verification method; polling semantics; applicable quota key; token expiry/reauth state; installed adapter/version. Observed earliest row is not proof no older rows exist. Distinguish `requested_window`, `fetched_window`, `source_confirmed_window` and `published_window`.

UI readiness states: connecting → validating identity → discovering coverage → backfilling → reconciling → merchant review → healthy/partial. Errors distinguish customer authorization required, platform review pending, quota delay, schema drift and Lumi defect. A silent green spinner is unacceptable.

## Provider expansion

P0 certifies Nhanh and uses a small Haravan reference fixture to test the model; Shopee access discovery runs immediately. P1 certifies Haravan and Shopee when authorization/test data exists. P2 prioritizes TikTok Shop if three qualified merchants demonstrate the same costly gap. Shopify can validate bulk/backfill patterns but is not automatically the Vietnam sales priority. Lazada, Sapo, KiotViet, ads, carriers and accounting are demand-gated: an existing paid decision, usable official access, reusable semantics and support budget are required.

Authorized CSV/JSON exports are a first-class temporary source with file schema, issuer, coverage, checksum and expiry—not a pretend live API. A source transport change must not double-count old and new observations.

## Acceptance

- **C02-A01:** token for business B submitted during A installation fails identity binding; no data is ingested.
- **C02-A02:** a token with one of four warehouses shows restricted coverage and cannot publish company-wide available stock as complete.
- **C02-A03:** installation succeeds but fee API is unavailable: Money Truth displays missing fees and does not report complete contribution margin.
- **C02-A04:** reauthorization changes credentials only, not canonical IDs; credentials are absent from logs/fixtures.
- **C02-A05:** provider rate error, expired auth and unsupported resource produce different actionable states.
- **C02-A06:** an export later replaced by direct API observations preserves one business entity and a documented source-authority transition.

References: [N1–N6, H1–H4, S1](../research/sources.md).
