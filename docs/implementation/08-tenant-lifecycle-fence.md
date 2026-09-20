# Implementation 08 — Tenant lifecycle fence

Status: implemented in the control-plane fixture/runtime boundary; authenticated
Cloudflare fleet migration, restore and deletion certification remain pending.
Canonical owner: [C01 control plane and tenancy](../specs/commerce/01-control-plane-and-tenancy.md),
with privacy/deletion consequences owned by [C22](../specs/commerce/22-security-privacy-and-data-rights.md).

## Outcome and boundary

Tenant access now has a canonical, auditable lifecycle record separate from the
legacy two-state deployment compatibility field. The control plane supports
`PROVISIONING`, `VALIDATING`, `ACTIVE`, `SUSPENDED`, `EXPORT_PENDING`, `DELETING`,
`DELETED` and `FAILED`, with a monotonic revision, reason and update time.

Interactive membership/session authorization joins the lifecycle record and only
serves `ACTIVE` tenants. Non-active states therefore fail closed before a cell
database read. Pack activation also requires the lifecycle to be `ACTIVE`.

## Operator API

`PUT /api/control/tenants/{tenant}/lifecycle` is an operator-only route. It accepts
`{state,reason}` and requires `If-Match: "<lifecycle revision>"`. Valid transitions
are explicit; stale revisions, invalid states, forbidden transitions and non-operator
requests have no state side effect. Every successful transition writes control audit
metadata. `DELETED` is terminal in this boundary.

The transition fences access; it does not pretend to erase raw objects, serving data,
backups, credentials or exports. Deletion propagation, suppression/replay ledgers,
restore sequencing and legal retention remain C22/C23 gates.

## Evidence

`tests/control-lifecycle.test.mjs` exercises initial lifecycle visibility, optimistic
revision conflicts, operator-only mutation, access denial during suspension, recovery
to active, deletion fencing without false erasure, terminal-state behavior and audit
records. `tests/control.test.mjs` and `tests/ops.test.mjs` retain existing license,
pack and generated-provisioning regressions.

This is fixture/runtime evidence only. It is not a live Access, multi-cell cutover,
restore, support-grant or production deletion certification.
