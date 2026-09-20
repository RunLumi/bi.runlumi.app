# Implementation 03: reviewed commerce publication and decisions

Date: 2026-09-20. Evidence level: bounded implementation with synthetic regression
cases. Not merchant-certified, source-completeness-certified or Cloudflare-certified.

## Observable workflow

Owner authorizes an export scope → uploads Lumi interchange JSON → retains private
raw evidence → normalizes or quarantines → inspects identities → selects source
snapshots → declares independent controls and reviewed identity links → previews
exact results → explicitly publishes → investigates observed exceptions → records
and verifies an outcome. The React routes are `/commerce-data` and `/money`.

A platform operator has no implicit access. An editor/viewer has no access to these
owner/data.import review surfaces. Fine-grained finance-reader grants and general
commerce semantic querying are separate implementation work; these routes do not
claim to implement those permissions or the operations pack's metric allowlist.

## Source authorization

`commerce_connections` remains an immutable provider/account/resource identity.
HTTP onboarding creates an **authorized-export** scope with an approval reference;
it does not perform OAuth or prove a Nhanh/Haravan/Shopee account. Pause/revoke uses
a strong If-Match revision. Every change keeps actor, reason and revision in an
immutable source event. A revoked connection cannot be reactivated.

Source revisions are rechecked for normalization, publication, retained reports,
staging inspection, exports and stored decisions. Resuming permission does not
retroactively grant the old approval: reimport under the new revision. Source
revocation is distinct from a completed privacy-deletion workflow, which is not
implemented here. Central user/license/tenant admission checks still run first.

## Identity and source authority

Object identity is `(tenant, provider, source account, resource, source ID)`, not
a connection-installation ID. A reinstall does not create a second economic order.
Two snapshots of the same source resource cannot coexist in a publication.

One source's different IDs remain different objects even when amounts/dates match.
Multiple sources of the same resource require reviewed links for **every** object.
The owner supplies canonical ID and priority; smaller priority wins. Equal-priority
conflicting observations block publication. Mirrored records and deliberate source
priority choices remain in the published exclusions. Amount similarity is never an
automatic identity rule. Mapping bundles are immutable and content-addressed.

Physical inventory first resolves the latest source pool/variant observation. Equal
instant but conflicting gauges block. Advertised/channel allocation stock is not
summed. Cross-source physical pools need explicit reviewed aliases. Available stock
is the supplied authoritative field; reserved units are not subtracted again.

## Reconciliation and financial meaning

The owner may declare independent record count, merchandise sales or finalized
settlement controls per selected normalization. Mismatch blocks preview/publication.
An entered reference is **owner-declared, not independently authenticated**. A match
does not turn the report into certified completeness or statutory accounts.

Financial strings use exact BigInt arithmetic and explicit tax conventions. The
recognized-order cohort is defined by original order timestamps and updated as
known at the source observation time. The exposed contribution includes explicitly
supplied earned shipping income/subsidies and variable charges. Unknown components
keep contribution null. Historical COGS needs an evidence reference. A positive
shipping balance, subsidy or withholding is not silently inserted into net sales.

Finalized statement components, provisional statements and observed allocated cash
remain separate. Reused receipt allocations are rejected. A payout gap is not
platform fault, recovered cash or a banking-ledger certification. Every report
remains `PROVISIONAL` with `sourceCompletenessCertified: false` and
`merchantVerified: false`. Integer/decimal strings are preserved in JSON/CSV and UI;
a spreadsheet importer may still coerce long numeric strings unless configured as
text. CSV/JSON is not an XLSX export or a PDF financial statement.

## Immutable publication protocol

A candidate contains 1–10 normalization IDs, optional immutable mapping ID,
declared controls, expected active publication ID and expected revision. Inputs
must be current-source-authorized, normalized, same-window and compatible with the
pinned normalizer. The preview hash includes tenant, route epoch, selected versions,
control/mapping configuration, expected predecessor and exact report hash.

Publishing requires the same hash and a bounded human reason. In one D1 batch:
insert the immutable report; retain normalized input references; compare-and-swap
the active head; record audit; update receipt publication pointers. Losing a race
cannot expose a half-published report. Identical concurrent submissions converge.
The database prevents rewriting retained reports/mappings; checksums detect tampering.

A successor cannot silently omit a previously published source, move the end window
backward, move a source observation backward, or change normalized content while
claiming the same observation time. Prior report IDs retain historical cost/math.
A metadata-only status endpoint lets an authorized owner pin a repair without
opening invalidated report amounts. Explicit scope retirement and full data-schema
rollback are future work, not an omission override hidden in this API.

Bounds: 100 records and 48,000 raw UTF-8 bytes per receipt; 10 source snapshots;
512,000 bytes per report; 50 rows per metadata page; 50 decision/history entries
with history truncation disclosed. This is not the scalable bulk ingestion path.

## Observed investigations and decisions

Deterministic rules detect missing historical cost, missing charges/earned income,
negative known contribution, unmatched finalized payouts, and missing/nonpositive
physical availability. They do not infer causal drivers, forecast demand or assert
that no findings means no business risk.

A decision must name a finding in the **current** report. Duplicate opens converge.
Owner, rationale, deadline, original finding/detector/report and immutable transition
history are retained. States are OPEN → INVESTIGATING → AWAITING_OUTCOME → RESOLVED,
with explicit accepted-limit and return-to-investigation paths. Writes use strong
revision checks and transactional audit; terminal recurrence requires review.

Resolution needs a distinct current report, same source window, semantic/tax basis
and immutable mapping, with the same entity and a **positive known resolution
predicate**. An entity disappearing, cost becoming unknown, a final statement
becoming provisional, or a changing window does not prove an outcome. Resolution
records `recordedRecovery: "0"` and `externalActionExecuted: false`; no external
systems are written and no claim of causation or cash recovery is made.

## API and UI coverage

See [API](../api.md) for routes and payloads. Private exports reauthorize retained
publication inputs, send no-store responses and avoid spreadsheet-formula injection.
The UI handles failed/stale/unavailable states, exact number formatting, current
publication context, source hashes, quarantine, review, actions and identity changes.
Tables scroll inside components instead of clipping the whole page.

Runtime suites: `tests/commerce-normalization.test.mjs`,
`tests/commerce-publication.test.mjs`, `tests/commerce-connections.test.mjs`,
`tests/commerce-decisions.test.mjs`. Real browser workflow tests are
`apps/web/e2e/commerce-workflow.spec.ts`, alongside the existing regression suites.
These cover local SQLite/WebCrypto, not real workerd/Access/R2 permissions or
production distributed-failure behavior.

## Requirement mapping and remaining gates

Partial or bounded evidence for C02 authorization; C06 replay/quarantine/atomic
manifest activation; C07-A01/A03 identity and source authority; C08-A01 missing-row
control failure; C09-A01/A02/A03/A05/A06/A07/A08 math/display/retained revisions;
C12 finalized statement/cash distinctions; C13 physical stock; C16 decision records;
C18 honest review UX; C19 authenticated CSV/JSON; C22 revocation; C26 regression cases.

This does not close entire specifications. Remaining: live certified adapters;
source-complete chunked sync and leases; line/bundle/fulfillment/refund event models;
row/field finance policy; general query budgets; AI inference; demand/stock-aging
and customer/marketing packs; scheduled delivery/embeds; automated action handoff;
privacy deletion; billing/provisioning/Git attestation; workerd and merchant gates.
