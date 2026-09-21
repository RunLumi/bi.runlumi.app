# Validation boundary

The automated evidence for this repository has four layers, all runnable
locally with no Cloudflare account or billable resource:

1. `npm run check` — typecheck, behavioral tests (89: auth and setup takeover,
   role and revocation behavior, the full commerce pipeline with exact
   arithmetic and NULL semantics, jobs with leases and retries, publication
   CAS and revocation closure, insights, exports), repository contract checks
   and licensing gates.
2. Browser journeys — Playwright suites in `apps/web`: the demo UI checks and
   a strict first-run journey (setup → sign-in → user management → import →
   dashboard) against real rendered forms with an empty installation.
3. `node scripts/workerd-check.mjs` — the packaged tarballs under real local
   workerd with real local D1: migrations, setup, sign-in, fail-closed auth.
4. `node scripts/acceptance-two-customers.mjs` — two independent customer
   repositories generated from the same packaged release: build without
   upstream paths, their own tests, promoted reports, the full commerce
   journey against the packaged artifacts, cross-installation isolation, a
   real N+1 upgrade carrying a behavior change, custom-file preservation,
   rollback records and deployment-identity gates.

These layers prove deterministic behavior, not a live Cloudflare deployment,
DNS, provider access, or production backup durability. Live deployment,
account configuration, identity-provider setup and legal review remain
separate evidence layers. See `docs/delivery-checklist.md` for the full
capability-to-evidence mapping.
