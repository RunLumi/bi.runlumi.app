# 0001: Shared product with tenant databases and deployment cells

Status: accepted for bootstrap. Date: 2026-09-20.

## Decision

Keep one application repository and immutable release. Tenant settings, source
mappings and dashboards are data. Use a control D1 for membership/routing and a
separate serving D1 per tenant, grouped into small deployment cells. Preserve a
dedicated-cell path without a customer app fork.

## Alternatives

One app repo per customer is initially convenient but creates divergent security
patches, schemas and metrics. One pooled D1 with tenant_id alone is simpler to
provision but weaker against a missed filter. One Worker/account per customer
is stronger resource separation but introduces deployment overhead before demand
is proven. Choose the middle path, with explicit rather than claimed isolation.

## Consequences

Per-tenant migrations, restore and routing become first-class operational work.
A shared Worker holds all cell DB bindings and remains a cell-wide risk boundary.
Source objects have tenant prefixes but a shared bucket does not independently
enforce per-prefix application identity. Sensitive data may need stronger dedicated
resources and account separation.

## Revisit

Change cell size when actual contention, access requirements, deployment overhead
or blast-radius requirements justify it. The current 50-tenant generator cap is
an internal guard, not a Cloudflare maximum or a validated capacity forecast.
