# Implementation 02: retained evidence to immutable typed revisions

Status: executable bounded export normalizer, not live-provider or merchant certification.
Canonical owners: [C06](../specs/commerce/06-ingestion-replay-publication.md),
[C07](../specs/commerce/07-canonical-commerce-and-identity.md),
[C09](../specs/commerce/09-semantic-metric-contract.md),
[C12](../specs/commerce/12-settlement-cod-and-cash-pack.md),
[C13](../specs/commerce/13-inventory-and-replenishment-pack.md).

## Implemented boundary

`POST /api/tenants/{tenant}/commerce-normalizations` with `{ "receiptId": "cr_..." }`
consumes already accepted, retained raw evidence. The existing independent tenant
admission and owner/data.import checks apply before object reads. GET on the same
route, optionally with a normalization ID, returns bounded metadata, not raw rows.
The explicit owner-only `GET /commerce-staging/{id}` inspector exposes checked
normalized identities for mapping review, rechecking active source scope first.

The consumer validates active source revision, tenant/route identity, deterministic
object key, byte limit and raw checksum. It checks the embedded provider, account,
resource and exact window against the immutable receipt envelope. It accepts only
explicit snapshots; legacy envelopes lacking event semantics require reviewed
re-import with a new delivery ID. Normalization never publishes a metric.

`lumi.commerce.export.v1` is Lumi's interchange contract, **not** the response
schema of Nhanh, Haravan or Shopee. Provider labels preserve declared origin; they
do not certify that source. Unsupported formats remain retained and quarantined.
`commerceSchemaFingerprint()` hashes the pinned `schemaDescriptor` in
`packages/core/commerce-model.ts`. Any incompatible validator change needs a new
contract/normalizer version, new fingerprint and regression fixtures.

## Supported grains and meaning

- Orders: one immutable source-order observation, preserving a string ID,
  order-cohort timestamp, recognition timestamp, original reductions/reversals,
  net historical COGS with evidence reference, nullable net variable charges, and explicit earned shipping income/subsidies.
  All money uses the required `net-merchandise-actual-cash-v1` tax policy: exclude
  separable sales tax from merchandise and recoverable input tax from costs;
  preserve actual transfer values for cash and settlement. No tax rate is guessed.
  `fulfilled-order-cohort-v1` reports recognized merchandise for the selected
  **original order cohort, as known at export observation time**. It is not a
  recognition-event-date or refund-event-date P&L. An export producer must supply
  only the recognized merchandise components, not unfulfilled order value.
  Partial-shipment line normalization and return/refund/restock axes are not yet
  implemented. No current catalog cost is inferred or fetched.
- Settlements: signed classified statement components, final versus provisional
  status, optional due date and owner-declared matched cash observations with
  evidence references. A receipt cannot be allocated to two statements in the
  same export. No fuzzy or cross-export bank matching is implied.
- Stock: one observation at a time for a source-scoped pool/variant, retaining
  physical versus advertised kind and separate on-hand/reserved/available values.
  Supplied available=10 and reserved=3 stays available=10. No aging, movements or
  unconstrained demand is inferred.

Unknown required fields, invalid times, unknown financial components, wrong
signs, out-of-window rows and duplicate object IDs are rejected/quarantined.
An order with unknown state cannot be recognized. Empty exports normalize to
zero rows but do not prove completeness. A future publication must not treat an
empty snapshot as authorization to erase another scope.

## Precision and budgets

VND amounts are canonical integer **strings**, up to 30 digits per input. BigInt
arithmetic preserves exact totals; no floating-point money enters a D1 column.
Quantities use exact scaled integers with up to six fractional decimal places.
Ratios use exact sums and half-away-from-zero rounding; denominator zero is null.
Largest-remainder allocation conserves every minor unit and ties by stable ID.
Vietnam business dates use UTC+07:00 with a documented half-open interval.

Each raw object stays capped at 48,000 UTF-8 bytes, at most 100 source records and
200 nested financial entries. No larger importer cap, new runtime dependency or
management API token is introduced. Missing COGS keeps gross profit unavailable;
missing fees, earned shipping income or subsidies keeps contribution unavailable. No recognized rows returns null
money metrics rather than manufacturing a zero sales claim.

## Durable result and retry

Apply tenant migration `0004_commerce_normalization.sql` before exposing the route.
`commerce_normalizations` is immutable and unique per tenant/receipt/normalizer
version. Its ID is deterministic. Successful typed payload, content hash, receipt
checkpoint and local audit update commit in one D1 batch. Competing consumers
converge. A source/route change while reading R2 prevents this commit.

Unsupported business schemas produce `QUARANTINED` with a stable reason code;
raw bytes remain untouched. Missing/corrupt R2 evidence is a retryable service
failure, not a falsely normalized receipt. DB failure rolls back all stage writes.
A new corrected source export must use a new delivery ID. New normalizer versions
create new immutable revisions; this does not rewrite a prior publication.

No long-running lease, deployed Queue/cron consumer, orphan collector or
prolonged-outage recovery claim is added. The HTTP consumer is a bounded manual
path; production service-principal dispatch remains a separately tested gate.

## Evidence and remaining acceptance

`tests/commerce-normalization.test.mjs` runs the actual TypeScript normalizer and
exact arithmetic, including shared reference G01–G06 and G08/G09 behavior,
source reconnect/different-shop identity, large string IDs, local midnight,
source mismatch, missing costs, schema quarantine, repeated/concurrent consumption,
source/route revocation, evidence tampering and transaction rollback.

C06-A04 is implemented for this interchange schema; C06-A02 is only the manual
logical processing boundary, not Queue-outage certification. C07-A03 source identity
and C09-A02/A03/A04/A05 pure arithmetic are tested. Cross-source authority, manifest publication and the dashboard/API paths are
covered in [Implementation 03](03-reviewed-publication-and-decisions.md).
C09-A01 is still partial while Ask Lumi is absent. These tests do not certify provider fidelity, merchant reconciliation,
field-level financial permissions or production workerd behavior.

## Platform references

Reviewed 2026-09-20: Cloudflare D1 batch transaction semantics and per-statement
limits. Bound parameters remain far below 100 per statement; first-primary sessions
are used for stage writes. SQLite tests are not a substitute for workerd/staging.

- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/platform/limits/
