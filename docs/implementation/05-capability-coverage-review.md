# Implementation 05 — reviewed capability and coverage evidence

Status: executable owner-reviewed capability boundary; provider, merchant and Cloudflare certification pending.
Canonical owners: [C02 source installation](../specs/commerce/02-source-installation-and-sdk.md) and
[C08 quality/reconciliation](../specs/commerce/08-quality-reconciliation-lineage.md).

## Implemented boundary

`POST /api/tenants/{tenant}/commerce-capabilities` lets an authorized tenant
owner record a per-resource capability state and bounded coverage manifest for an
existing export connection. `GET` returns the tenant-scoped capability matrix.
Records use optimistic revisions and immutable connection/resource identity;
coverage includes requested, fetched, source-confirmed and published windows,
shops, warehouses and masked fields. No credentials, raw rows or provider tokens
are accepted.

Publication reads these reviewed states. A non-supported `fees` capability
downgrades contribution to unavailable while leaving sales usable. A non-supported
`warehouse_scope` capability makes company-wide available stock unavailable. The
report carries an explicit warning and remains provisional; capability review is
not live provider verification or completeness certification.

## Evidence

`tests/commerce-capabilities.test.mjs` covers the real API boundary, owner-only
authorization, cross-tenant denial, optimistic revision conflicts, invalid state/
resource/date/coverage rejection and persistence. Existing publication tests cover
the exact metric null semantics and source revocation path.

Remaining C02/C08 work includes OAuth/PKCE installation, secret references,
provider capability discovery, authenticated source controls, warehouse-level
reconciliation and live adapter evidence.
