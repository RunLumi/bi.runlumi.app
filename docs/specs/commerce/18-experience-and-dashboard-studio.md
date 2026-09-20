# C18 — Merchant experience and dashboard studio

Spec: C18 | Status: Target contract | Stage: P0 guided desktop/mobile web, P1 configuration studio, P2 collaborative planning

Owns: information architecture, interactions and authoring UX. Existing DESIGN.md and ICON.md own visual identity. This spec does not authorize a rebrand or claim the static bootstrap is already React.

## Outcome

In a brief morning review, an owner understands what changed, which numbers are trustworthy and which decision needs attention. An operator can investigate without learning a BI query language. The advanced analyst can customize without creating another version of business truth.

## Product navigation

1. **Today / Hôm nay:** at most a few material decisions, source-health summary and due commitments.
2. **Money / Tiền:** sales contribution and settlement/COD views with clearly different lenses.
3. **Stock / Hàng:** stockout/aging/replenishment queues.
4. **Operations / Vận hành:** fulfillment/return/cost cases.
5. **Ask Lumi:** a contextual analytical surface, also available from a metric/case.
6. **Data & Settings:** connections, mapping, metric catalog, permissions, packs and source health.

Avoid ten dashboards for the same owner question. Saved workspaces may compose these surfaces; metric computation remains centralized.

## Onboarding journey

Select business objective → connect one source → verify shop/warehouse scopes → choose timezone/currency and recognition defaults → backfill progress with known limits → review SKU/channel overlaps → compare three concrete numbers with merchant controls → unlock one decision pack. Permit a useful partial state while clearly displaying missing cost/fee/traffic data. No blank canvas as the default first experience.

## Contract

- **C18-R01:** every KPI can show definition, value basis, source freshness, coverage, version and permitted drill-down within two interactions. Unavailable/partial/estimated values have textual labels, not just colors.
- **C18-R02:** mandatory UI states are loading, empty-valid, no permission, unavailable input, stale, partial, failed, reconciling and restated. Tenant switch clears old tenant data before new content renders.
- **C18-R03:** dashboard rendering pins one evaluation context; changing filters cancels/ignores obsolete requests. No chart from the previous filter remains under the new heading.
- **C18-R04:** responsive owner view works on narrow mobile web with one-column priority, accessible tables and deliberate drill-down. Do not rebuild native apps before web adoption evidence.
- **C18-R05:** customer-facing Vietnamese avoids internal terms such as 'cost center', 'AI takeover', 'paginator' or 'semantic DAG'. Use 'chi phí xử lý', 'phần việc tự động', 'nguồn dữ liệu' and 'cách tính'; retain technical diagnostics for operator mode.

## Dashboard-as-data studio

Widget types begin KPI, line/bar, table, waterfall and evidence/case list. Each references approved metric IDs and dimensions; formulas require C09/C20 review. Schema validation, optimistic revisions, undo/draft, preview, publish permission, impact diff and rollback are distinct controls. No arbitrary HTML/JS; labels render as text.

P1 supports curated templates, drag/resize with keyboard equivalent, shared filter context, table drill-through, saved views and role-aware defaults. Git-managed dashboards show draft/PR state and never overwrite release truth silently. UI-managed dashboards keep versions and can be promoted to Git packs. Custom widgets are reviewed platform extensions, not tenant code evaluated inside the main Worker.

## Implementation direction

Target React + TypeScript + Vite, accessible shadcn/Radix-derived primitives where licensing/dependency review permits, and the existing Lumi icon contract. Migrate by vertical surface while preserving semantic/API tests; do not rewrite the backend for frontend fashion. Keep query state, UI drafts and committed definitions separate. Chart library must pass Vietnamese labels, large integer/currency formatting, keyboard/readable-table alternatives and screenshot regression tests.

Financial values use consistent Vietnamese formatting and visible unit/scale. Export retains exact values even when display uses compact units. Do not use animation that masks stale transitions, gratuitous AI effects or a dark data-terminal redesign contrary to DESIGN.md.

## Acceptance

- **C18-A01:** five target-role users can find an unmatched payout's explanation and owner without developer assistance; record failure points.
- **C18-A02:** screen-reader/keyboard users can inspect a chart's data table and perform approval-free analysis flows.
- **C18-A03:** switching tenant/filters under slow network never shows previous data under a new context.
- **C18-A04:** custom dashboard changes show definition/source impact and require publication permission.
- **C18-A05:** unavailable cost data produces an actionable explanation, not a zero-value chart.
- **C18-A06:** mobile Today shows a concise decision queue and readable evidence, not a shrunken desktop grid.
