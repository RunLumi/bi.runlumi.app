# API surface — commerce foundation

All `/api/*` routes require verified identity. Tenant routes resolve active
membership and validate selected database identity. Private responses use
`Cache-Control: private, no-store`. Role checks execute on the server.

| Method and path | Role | Behavior |
| --- | --- | --- |
| GET `/healthz` | Public | Process alive; explicitly not production-ready |
| GET `/api/session` | Authenticated | Membership-filtered tenant list in this cell |
| GET `/api/tenants/:tenant/metrics` | Viewer+ | Metric catalog, no executable SQL |
| POST `/api/tenants/:tenant/query` | Viewer+ | Strict semantic request, bounded result + lineage |
| POST `/api/tenants/:tenant/query-batch` | Viewer+ | `{queries, configurationRelease, configurationRevision}`; max 12 plans, one context/transaction |
| GET `/api/tenants/:tenant/readiness` | Viewer+ | Deployment capability inventory; no live merchant certification |
| GET `/api/tenants/:tenant/configuration` | Viewer+ | Safe active pack summary; provenance/AI implementation status |
| GET `/api/tenants/:tenant/dashboards` | Viewer+ | Dashboard definitions |
| GET `/api/tenants/:tenant/dashboards/:id` | Viewer+ | One definition or 404 |
| POST `/api/tenants/:tenant/dashboards` | Editor+ | Create `{id, definition}`; revision starts at 1 |
| PUT `/api/tenants/:tenant/dashboards/:id` | Editor+ | Full definition; `If-Match: "<revision>"` required |
| POST `/api/tenants/:tenant/imports` | Owner | Registered-source bounded snapshot; `Idempotency-Key` required |
| GET `/api/tenants/:tenant/imports` | Viewer+ | Recent metadata; no R2 download capability |

Bodies must be JSON and at most 64 KiB. API mutation requests reject cross-origin
browser requests. There is no wildcard CORS, raw SQL endpoint, source-credential
endpoint, export URL, anonymous embed or connector-credential endpoint.

Production identity: a validated Access JWT with expected issuer/audience,
RS256 signature, expiry and subject. Tenant membership is a separate database
check, not assumed from Access login alone. Local synthetic demo identities live
only in `scripts/local-adapters.mjs`.

Important response codes: 400 contract error, 401 unauthenticated, 403 forbidden,
409 stale revision/idempotency conflict/stale snapshot, 413 oversized body,
415 incorrect MIME, 422 budget/quota, 428 required revision, 503 missing/mismatched
trusted deployment configuration. Errors contain a code and request ID, never a
raw database message, source row or token.

A replayed successful import returns its original snapshot ID and `replayed:true`.
A reused idempotency key with a different normalized payload is a conflict. The
normalized row order is currently part of the payload checksum.

## Central control (operator routes)

The cell forwards `/api/control/*` through the private CONTROL binding; there is no
public control Worker route. Operator role does not grant tenant-data membership.

- GET `/api/control/overview`: bounded tenant/user metadata only.
- PUT `/api/control/tenants/:id/license`: `{license,reason}` plus strong If-Match.
- GET/POST `/api/control/tenants/:id/releases`: list/register compiled operator bundle.
- POST `/api/control/tenants/:id/activation`: `{releaseId,routeEpoch,reason}` plus If-Match.

Registration requires the server-owned repository/path mapping. It returns
`provenance: operator-asserted`, `attestationVerified: false`. No GitHub verification
or CI token-exchange endpoint is implemented. See [tenant packs](tenant-packs.md).

## Dashboard evaluation context

Query-batch requires the release and revision from the dashboard definition. UI
and Git-managed definitions both include these fields. It validates all plans
before one D1 batch, returning `{context,contextHash,results}`. Each result repeats
the context hash and carries source coverage, per-source timestamps and row counts.
Limits: 12 plans, 7 known metrics/plan, 93-day range, 200 rows/plan, 512 KB result
payload. These are prototype budgets, not measured production SLAs or fair-share
admission. Missing data/coverage does not become evidence of zero business activity.

Configuration changes return `CONFIGURATION_CHANGED` (409); stale data-cell identity
returns `TENANT_ROUTE_FENCED` (503). No cached response bypasses current authorization.

## Commerce raw-receipt increment

`POST /api/tenants/{tenant}/commerce-receipts` accepts a bounded owner-authorized
export only for a reviewed active connection. New receipt: 202; identical replay:
200; delivery-ID conflict or mid-upload source/route change: 409. Both POST and
metadata-only `GET /api/tenants/{tenant}/commerce-receipts[/{receiptId}]` require
owner membership and `data.import`. No raw JSON, object URL or credential is returned.
These internal foundation routes do not imply a versioned public partner API.
See the [envelope, error and durability contract](implementation/01-durable-export-receipts.md).

## Commerce normalization (implementation 02)

Owner + `data.import`: `POST /api/tenants/:tenant/commerce-normalizations` accepts
`{ "receiptId": "cr_..." }`. Returns a deterministic immutable normalization ID,
state (`NORMALIZED` or `QUARANTINED`), stable reason, record count and hashes.
Both outcomes return HTTP 200; inspect state. Missing/tampered raw evidence returns
503; a route/source race returns 409. GET collection or `/:normalizationId` returns
bounded metadata. No raw rows or R2 URLs are exposed. See
[the exact supported interchange contract](implementation/02-normalization.md).

## Bounded commerce review workflow (increments 02–03)

All routes below use `/api/tenants/{tenant}` and currently require an independently
verified **owner** with `data.import`. Editor/viewer/platform-operator identities
have no implicit access. These are export-owner review tools, not a general
field-scoped financial-reader API. No raw SQL is accepted.

| Route | Method | Contract |
|---|---|---|
| `/commerce-connections` | GET | Up to 50 approved source identities/revisions, no credentials |
| `/commerce-connections` | POST | `{id, provider, sourceAccountId, resourceType, approvalRef}` authorizes an export scope, not a live OAuth connector |
| `/commerce-connections/{id}` | PUT | `{state, reason}`, strong `If-Match: "revision"`; revoked is terminal |
| `/commerce-staging/{normalizationId}` | GET | Checksum-verified normalized identities/values after current source authorization; not published |
| `/commerce-mappings` | POST | `{evidenceRef, entries:[{sourceKey, canonicalId, priority}]}` immutable owner-reviewed mapping |
| `/commerce-publications/status` | GET | Only current head ID/revision, including for repair when source data access is blocked |
| `/commerce-publications/preview` | POST | Candidate below, exact preview hash/report; no publication |
| `/commerce-publications` | POST | Same candidate + `previewHash`, `reason`; atomic publication and revision advance |
| `/commerce-publications[/{id}]` | GET | Current or retained immutable report, scope rechecked and hash verified |
| `/commerce-insights` | GET | Deterministic observed findings pinned to current report, no autonomous actions |
| `/commerce-decisions` | POST | `{publicationId, findingId, rationale, dueOn:null|"YYYY-MM-DD"}`; current real finding only |
| `/commerce-decisions[/{id}]` | GET | Owner-scoped register; detail includes immutable transition events and truncation flag |
| `/commerce-decisions/{id}` | PUT | `{state, note, outcomePublicationId:null|"cp_..."}` with strong If-Match; positive result evidence required for resolution |
| `/commerce-exports/{publicationId}?format=csv` | GET | Private snapshot metric CSV; `json` preserves full bounded report; no public token or XLSX claim |

Candidate:

```json
{
  "normalizationIds": ["nb_..."],
  "mappingId": null,
  "controls": [],
  "expectedRevision": 0,
  "expectedPublicationId": null
}
```

Independent controls (optional but absence stays visible):
`{normalizationId, recordCount, netSales:null|"integer", expectedSettlement:null|"integer", evidenceRef}`.
A count/value mismatch blocks. The evidence is owner-declared, not automatically
verified as independent. See [implementation 03](implementation/03-reviewed-publication-and-decisions.md)
for exact limits, tax/time basis and state transitions. All data and error responses
are `private, no-store`; mutation requests reject cross-origin contexts.

Apply additive tenant migrations `0004` through `0006` before enabling these routes.
There is no deployed Queue consumer, source polling scheduler or external action in
these endpoints. Unsupported vendor formats remain quarantined rather than guessed.
