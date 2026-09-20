# ADR 0008 — Canonical tenant lifecycle fence

Status: accepted for the current control-plane boundary.

## Decision

Add a control-D1 `tenant_lifecycle` record with explicit states, revision, reason
and update time. Keep the original `tenants.state` as a coarse compatibility field
for existing deployment guards, but derive interactive access from the lifecycle
record. Session and membership resolution require both the legacy active flag and
`tenant_lifecycle.state = ACTIVE`; pack activation has the same fence.

Lifecycle changes are operator-only, optimistic and transition-validated. They
write control audit metadata and do not perform deletion as a side effect. A future
offboarding implementation must separately fence writers, revoke credentials,
propagate deletion/suppression, reconcile R2/D1/backups and verify postconditions.

## Consequences

Suspension and offboarding can fail closed immediately without overloading a legacy
boolean or implying that a data-retention operation has completed. Existing bootstrap
fixtures and generated inventories seed an explicit `ACTIVE` lifecycle row. Live
fleet migration, recovery and privacy/legal retention remain external gates.
