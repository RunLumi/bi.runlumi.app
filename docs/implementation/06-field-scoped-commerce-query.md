# Implementation 06 — field-scoped commerce query

Status: executable bounded role-scoped query boundary; merchant and Cloudflare certification pending.
Canonical owners: [C10 query serving](../specs/commerce/10-query-serving-and-budgets.md) and
[C22 security/privacy](../specs/commerce/22-security-privacy-and-data-rights.md).

## Implemented boundary

The existing `lumi.query.v1` endpoint now derives field authority from the
server-authenticated tenant role. Owners may query the full reviewed metric
catalog. Viewers and editors receive only non-sensitive sales, order-count and
stock-count metrics. Cost, gross profit, contribution, fees, settlement and cash
fields are rejected with `COMMERCE_FIELD_DENIED` before publication data is read.

The viewer catalog is filtered server-side, the evaluation context hash includes
role, and the result envelope identifies the effective role and sensitive-field
boundary. All roles still pass through tenant routing, publication checksum,
source-revocation and snapshot checks. No hidden metric is returned or derivable
through a privileged cache; no raw SQL or raw evidence is exposed.

## Evidence

`tests/commerce-query.test.mjs` exercises owner and viewer requests through the
real local API, exact values, sensitive-field denial, stale/absent publications,
cross-tenant isolation and injection-shaped metric IDs. Full local and remote
checks remain the required evidence for integration.

This is intentionally not the complete C10/C22 policy system. Row scopes,
column policies beyond the reviewed metric set, saved-query permissions, cache
admission, support access, field-level exports, and AI history policy remain open.
