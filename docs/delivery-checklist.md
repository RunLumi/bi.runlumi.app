# Delivery checklist — standalone customer-deployable Lumi BI

One canonical mapping from each required capability to its implementation,
behavioral evidence and remaining boundaries. Evidence classes:

- **[T]** behavioral test in this repository (`npm test`)
- **[B]** real-browser journey (`apps/web` Playwright, demo + strict configs)
- **[W]** real local workerd + local D1 (`scripts/workerd-check.mjs`)
- **[A]** two-customer package-consumer acceptance
  (`scripts/acceptance-two-customers.mjs`)
- **[CI]** enforced on the delivered commit by `.github/workflows/ci.yml`

## 1. Standalone architecture

| Capability | Implementation | Evidence |
| --- | --- | --- |
| One installation, fixed `DB`/`SOURCES` bindings | `packages/core/src/ports.ts`, `api.ts` (`dbFor`/`storeFor`), starter worker | [T] `installation-*`, [W], [A] |
| No tenant/fleet/registry machinery, incl. no recreation under other ids | repository-wide; forged `tenantId`/`installationId` body fields rejected | [T] `commerce-receipts` forged-field, [A] B1 forged probe |
| Request/jobs/payloads never select another database | no such surface exists; isolation proof in acceptance | [A] D1 |
| Operates without Lumi-operated services | no runtime call-out exists; vendor tarballs, offline install | [A] A3/B1, [W] |
| Licensing and third-party notices preserved | `LICENSING.md`, `NOTICE`, per-build notices | [T] `licensing-policy`, [CI] |

## 2. Secure setup and direct authentication

| Capability | Implementation | Evidence |
| --- | --- | --- |
| Direct email+password sign-in/sign-out | `installation-auth.ts` (`loginInstallation`, `logoutInstallation`), `features/auth.tsx` | [T] auth suite, [B] strict journey |
| Secure credential storage | `password.ts` — salted PBKDF2-SHA256, 210k iterations | [T] hashing test |
| Bounded sessions, server-side validation | 14-day sessions, per-request revalidation, expiry sweep | [T], [W] |
| Resource/config validation with clear errors | typed parsers + stable error codes; guide chapter 13 table | [T], guide |
| One-time setup; permanent closure; concurrency safety | singleton installation row, batch init | [T] setup journey |
| Setup takeover protection | optional `SETUP_TOKEN` secret, timing-safe compare | [T] |
| User creation, role change, disablement, recovery | users API + Administration screen | [T] installation-api, [B] strict journey |
| Last-administrator protection | `assertNotLastActiveOwner` | [T] |
| Server-side authorization on every data/mutation surface | role checks in API + modules | [T] role matrix, [A] B1/E |
| Disabled user blocks access incl. saved results/exports | session revocation + export/insight checks | [T] commerce-publication revocation, starter suite |
| CSRF / cross-site denial | origin + sec-fetch-site checks | [T] auth suite |
| Demo headers never authenticate production | demo flag only in local demo server; starter uses `authenticateInstallation` | [W] header probe |
| Access/SSO optional | `authenticateInstallation`: session → optional Access → fail closed | [W], [T] |

## 3. Operational BI features

| Capability | Implementation | Evidence |
| --- | --- | --- |
| Source registration, authorization, revocation | sources API, commerce connections | [T] sources + commerce-connections |
| Immutable evidence, checksums, idempotent replay | R2 content-addressed receipts, snapshot hashes, `RECEIPT_EVIDENCE_IMMUTABLE` triggers | [T] commerce-receipts/data |
| Normalization, quarantine, recoverable failures | `commerce-normalization.ts`, quarantine reason codes | [T] commerce-normalization |
| Reviewed mappings, preview, atomic publication, history | `commerce-publication.ts`, CAS head revision | [T] commerce-publication |
| Typed semantic queries, consistent dashboard context | `query.ts` context hash, `commerce-query.ts` pinned publications | [T] both suites |
| Sales/margin, settlement/COD, physical stock | `commerce-model.ts`/`commerce-report.ts` exact BigInt arithmetic, NULL-not-zero, latest-gauge stock | [T] model + publication + query |
| Operational-cost reporting | operations metrics/snapshots/dashboards | [T] installation-data, [B] demo e2e |
| Saved reports with reproducible evidence | `commerce-insight-artifacts.ts` runs + publication hash | [T] commerce-insights |
| Findings, investigations, decision records, outcome evidence | `commerce-decisions.ts`, guarded transitions, new-publication proof | [T] commerce-decisions |
| Authorized exports | owner-checked CSV (BOM, formula-safe)/JSON with content hash | [T] commerce-publication exports |
| Durable jobs: retries, lease, recovery | `commerce-jobs.ts` 3 attempts, 60 s lease, dead-letter; scheduled runner in starter worker | [T] commerce-jobs |
| Revoked source or disabled user blocks subsequent access | publication reads/exports/queries fail closed | [T] commerce-publication revocation, [A] B1 |
| Exact arithmetic / NULL semantics / capacity-vs-cash distinction | BigInt minor units; nulls preserved; released-hours caveat in payloads and UI | [T] model + publication |

Live provider connectors and certifications are **not implemented and not
claimed**; authorized exports are the supported workflow (guide chapter 1/8).

## 4. Usable application

| Capability | Implementation | Evidence |
| --- | --- | --- |
| Setup, sign-in, admin, sources, commerce, decisions, reports screens | `packages/ui/src/features/*` | [B] both suites |
| Loading/empty/stale/failed/denied states | `states.tsx` + per-feature states; quality banner | [B], [T] |
| Identity change clears private client data | epoch-scoped QueryClient + `removeQueries` | [B] strict journey (sign-out) |
| Brand and visual direction preserved | core styles, shadcn-based components, Vietnamese labels | [B] content-containment |
| Desktop + mobile layout, keyboard access | skip link, focus rings, 320px containment checks | [B] content-containment |

## 5. Customer customization

| Capability | Implementation | Evidence |
| --- | --- | --- |
| Custom pages/reports/branding/metrics/connectors/rules/migrations/tests without core edits | `customer/` tree + `@runlumi/ui/app.tsx` composition | [A] C1/C2, A6 |
| Executable examples | `examples/customers/alpha|beta` (distinct pages + server metrics) | [A] C1/C2 |
| Reviewed custom code runs with privileges; model output never becomes code | promotion returns reviewed TSX text; boundary checks | [T] commerce-insights promote, [CI] boundaries |

## 6. Installation, updates, backup, recovery

| Capability | Implementation | Evidence |
| --- | --- | --- |
| Generate customer repository | `scripts/customer-new.mjs` | [A] A1/A2 |
| Configure local/staging/production resources | per-env inventories + wrangler config | [A] I1 |
| Initialize and run locally | `scripts/dev.mjs` (demo + `--strict`), guide ch. 5 | [B] strict journey |
| Explicit core/customer migrations | shipped SQL + guide commands; never automatic | guide ch. 3/11 |
| Build, validate, prepare deployment | customer `validate`/`build`/`deploy:plan` | [A] A4/I2 |
| Check and apply core updates | `scripts/upgrade.mjs` `--check`/apply, sha256 gate, dirty-tree refusal, lockfile-only update, reviewable diff | [A] F1 |
| Backup/restore | `wrangler d1 export/execute` procedures, R2 guidance | guide ch. 12 |
| Rollback of actual artifacts | vendor restore + re-deploy; migration limits stated | [A] H1, guide ch. 12 |

## 7. Documentation

- `user-guide/` — 13-chapter operator journey with exact, verified commands.
- `README.md`, `docs/*`, `SECURITY.md`, `CUSTOMIZATION.md`, `UPGRADING.md`,
  `VALIDATION.md` — aligned with the standalone architecture; contradictions
  with retired architectures removed.

## 8. Proof layers summary

- `npm run check` — typecheck + behavioral tests (100+, including the golden corpus and hardening regressions) + repo/licensing gates. [T][CI]
- `npm --prefix apps/web run test:e2e` — demo UI checks + strict first-run
  browser journey. [B][CI]
- `node scripts/workerd-check.mjs` — 7 runtime checks under real workerd with
  local D1. [W][CI]
- `node scripts/acceptance-two-customers.mjs` — two independent customers from
  one packaged release: build, tests, commerce journey, isolation, real N+1
  upgrade with a behavior change, rollback records, deployment-identity gates.
  [A][CI]

## 9. Platform-v1 hardening round (packaging, migrations, surface)

| Finding | Fix | Evidence |
| --- | --- | --- |
| Package build did not clear dist; obsolete build output (e.g. a deleted tenant router) could ship | build clears the owned dist before emit; regression test seeds a stale file and proves removal | [T] packaging test 1 |
| Packaged artifacts could carry retired multi-installation constructs | core-pack scans the actual packaged bytes against a narrow allowlist; pack fails closed | pack run log + [T] packaging test 2 |
| Migrate runner: shell-joined ledger reads, ledger failures treated as fresh DB, recording before the ledger table exists, no missing-history detection, unverified adopt | rewritten: argument-array invocations with pinned wrangler resolution, ledger bootstrap before recording, refusals on ledger read/parse failure and missing applied history, adopt verifies a compatible schema and never executes files; starter migration has a real statement | [T] migrate-runner suite (fresh/repeat/changed/missing/ledger-failure/adopt on a fake-wrangler adapter) + [A] A5b real local D1 |
| commerce-query comparison cleared the caller's current-period filters; coverage sliced UTC dates | comparison keeps the supplied query; coverage computed in declared business time (UTC+7) | [T] golden corpus + commerce-query |
| Wildcard package exports promised every implementation detail | documented supported surface (docs/public-surface.md) + check-repo gate freezing all application/extension @runlumi imports to it | [CI] check-repo "Public surface" line |
| SOURCE_CHECKSUMS listed retired cell-era paths; LICENSING named apps/control | checksums regenerated from tracked files; licensing inventory updated to the current tree | [CI] check-repo |

## 10. First-customer hardening round (previous)

Findings reproduced against ff58357 and fixed on this branch (all with
behavioral regression tests):

| Finding | Fix | Evidence |
| --- | --- | --- |
| Viewer could read COGS/profit via published queries | `assertCommerceMetricScope` enforced on `/api/commerce/queries` and `/ask`; viewer catalog hides sensitive metrics | [T] commerce-query tests 5, golden corpus |
| Upsert path demoted/disabled the last active owner | one guarded path for create+update; atomic last-owner guard inside the UPDATE; audit rows | [T] installation-auth 9 |
| Password reset left old sessions alive | administrative reset and self change revoke all sessions of the user | [T] installation-auth 11 |
| Known cost/profit became null under a valid date filter | filtered queries recompute the whole order cohort; grain-unfilterable metrics return null + `METRIC_GRAIN_UNFILTERABLE`; out-of-window ranges are marked, never zero-filled | [T] golden corpus |
| Timezone-naive date comparison | business-day windows resolved to half-open UTC+7 instant intervals | [T] golden corpus (midnight boundary) |
| `source` dimension grouped per-order hashes | groups by provider account (`sourceProvider:sourceAccount`), `totalGroups`+`truncated` explicit | [T] query tests |
| No durable login abuse control | `login_throttle` ledger: 5 failures / 15 min per login id, 429 `LOGIN_THROTTLED`, success clears | [T] installation-auth 10 |
| Open production setup race | production environments refuse initialization without configured `SETUP_TOKEN` (`SETUP_PROTECTION_REQUIRED`) | [T] installation-auth 13 |
| Ambiguous multi-action user mutations silently guessed | rejected with `AMBIGUOUS_USER_MUTATION` | [T] installation-auth 12 |
| Saved insight runs returned stale data after source revocation | per-run authority recheck; revoked runs withhold results (`PUBLICATION_SOURCE_REVOKED`) | [T] commerce-insights |
| Duplicate insight creation attached runs to a different definition | content-bound conflict (`INSIGHT_DEFINITION_CONFLICT`/`INSIGHT_TITLE_CONFLICT`) | [T] golden corpus |
| Refresh had no explicit semantics | pinned rerun (`basis:"pinned"`) vs latest refresh (`basis:"latest"`, must be the active head) | [T] golden corpus |
| Promoted TSX ignored its exported definition | generated component queries the pinned publication through the definition | [T] commerce-insights 2, [A] A6 |
| Scheduled runner used a fabricated owner user | explicit system authority (`kind:"system"`), audit actor `system:job-runner`, no sign-in path | code + starter |
| Rollback "evidence" was a lock edit | acceptance executes a real artifact rollback (updater + reinstall + runtime assertions + tests) | [A] H1 |
| Symlink check followed links | `lstat` | [A] A3 |
| Updater could leave a mixed vendor dir | staged copy with re-verified bytes, then swap | updater |
| No migration ledger | checksummed `schema_migrations` ledger + `npm run migrate` runner; applied history immutable | tool + guide |

Refuted against current code: the `X-Content-Type-Options` header is spelled
correctly (`nosniff`).

## Release gates

**Gate 1 — BASE_RELEASE_CANDIDATE: conditions and status.**
A new customer can be generated from checksummed release artifacts, configured
safely, run the supported authorized-export commerce/report workflow, and
survive a demonstrated compatible upgrade AND an executed rollback (updater +
reinstall + runtime assertions + tests) without losing custom code: exercised
by `npm run check`, both Playwright suites, `workerd-check`, and
`acceptance-two-customers` (A1–I2). Status conditions are met locally; the
formal PASS is declared on the release tag after CI runs on the exact
candidate.

**Gate 2 — FIRST_CUSTOMER_GO: BLOCKED on external inputs.**
Missing inputs that no local evidence can substitute: the named pilot's
identity, authorized source exports and volumes, real credential issuance,
production Cloudflare authorization, merchant reconciliation sign-off, and an
explicit product decision on the promised analytics-agent scope. The shipped
assistant is the curated deterministic path (`mode:"curated-deterministic"`,
`llmInvolved:false` on every response); no LLM, conversational editing or
predictions are implemented and none are claimed. Do not proceed to pilot
onboarding until each input is provided and tested against production.

## Remaining boundaries (honest)

- Live staging/production deployment, DNS and Access configuration require the
  customer's Cloudflare account and authorization — local evidence does not
  substitute for a real deployment (no billable resources were created).
- No live vendor connectors or certifications; authorized exports only.
- Backups are documented operator procedures, not scheduled automation.
