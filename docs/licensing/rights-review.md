# Rights and release checklist

This record separates the owner's selected license from proof of chain of title.
It is not a legal opinion. Baseline inspected: `15b282a7a6d8ce958c5df7f8480c2018bf7c59b0`.

## Evidence recorded for this change

- The repository owner explicitly approved implementing the discussed ELv2 core,
  narrowly scoped future Apache SDK/starter and commercial partner policy.
- Existing attribution is `Copyright (c) 2026 RunLumi`. It is preserved in NOTICE.
  This record does not decide whether that project name is the contracting entity.
- The three current npm projects are the root, React app and Astro landing site.
  There is no separately extracted original SDK/customer starter to relicense.
- Dependency versions/integrity and third-party notices are preserved. Existing
  licenses are not replaced with Lumi's chosen license.

## Open human/legal work (not certified by CI)

- [ ] Confirm actual legal rights holder and commercial contracting entity; retain
      incorporation/assignment evidence privately. Do not infer it from a brand.
- [ ] Review employee, contractor, external contribution and customer agreements
      covering the historical source, copied snippets, assets and documentation.
- [ ] Confirm grant authority for all covered original work; separately resolve or
      exclude any disputed/unlicensed material. Owner approval is not proof of
      ownership of somebody else's work.
- [ ] Have counsel approve contributor grant terms and the commercial/partner and
      bespoke-deliverable contract templates. No signed CLA is claimed here.
- [ ] Before offering commercial relicensing, verify rights for every included
      contribution and component, including necessary patent grants.
- [ ] Verify the published contact is monitored and review unusual hosted/OEM and
      white-label cases before granting special rights.

Keep signed contracts and personal information in an access-controlled record
system, not this public repository. Reference a non-sensitive evidence ID in a PR.
Historical license grants remain part of release history; do not rewrite tags.

## Adding a future Apache-2.0 exception

1. Extract a genuine thin client/interface or starter. No copied finance engine,
   policy enforcement, core service implementation or product UI masquerading as
   scaffolding. Review the distributed tarball, not just its manifest.
2. Record rights/provenance review and owner approval of the exact file/path scope.
3. Add a local unmodified Apache-2.0 license and attribution, plus a clear scope
   notice. Mark only those original files/packages Apache-2.0. Preserve every
   imported core and third-party component's terms.
4. Update `licensing-policy.json`, its boundary checks and LICENSING.md together.
   The currently empty Apache inventory cannot grow silently through a wildcard.
5. Verify package metadata, lock roots, notices and an isolated customer build.
   Do not imply the entire product has become Apache or that paid hosting is free.

## Distribution review

Run `npm run check:licensing`, the existing application checks and both web builds.
Verify `LICENSE.txt`, `NOTICE.txt` and `THIRD_PARTY_NOTICES.txt` actually ship.
Workers, npm packages, offline bundles and customer repos need equivalent artifact
checks when their release paths exist. Generated notices prove inclusion, not
legal clearance or a complete source-provenance audit.

Primary sources reviewed 2026-09-20:
- [ELv2 original](https://www.elastic.co/licensing/elastic-license)
- [Apache 2.0 original](https://www.apache.org/licenses/LICENSE-2.0)
- [Elastic contributor-agreement model](https://www.elastic.co/contributor-agreement)
- [DCO text](https://developercertificate.org/): provenance certification is not
  a substitute for whatever additional commercial relicensing authority is needed.
