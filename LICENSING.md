# Lumi BI licensing

**Source-available and self-hostable under Elastic License 2.0 (ELv2), not
OSI-approved open source.** This is a per-component licensing model, not a choice
to use the whole product under either ELv2 or Apache-2.0.

## Which license applies?

| Material | Current license / boundary |
| --- | --- |
| Original product source, including `packages/`, `apps/`, `migrations/`, `packs/`, `tests/`, `scripts/` and tooling | [Elastic-2.0](LICENSE) |
| Original documentation, design implementation and `web/` marketing source | Elastic-2.0; third-party notices and trademark law still apply |
| Thin SDK/client interfaces and customer starter scaffolding | Apache-2.0 **only after explicit, file/path-scoped approval**; none has been designated in this revision |
| Third-party code, adapted components, icons and fonts | Their existing licenses and notices; see [third-party provenance](THIRD_PARTY_NOTICES.md) |
| Future separately supplied proprietary modules or managed services | Only their explicit separately supplied terms; this does not reserve code already published here under ELv2 |
| Customer data, credentials, confidential material and independently written customer code | Not licensed or assigned to Lumi by this repository; use the applicable data rights and signed customer agreement |

[licensing-policy.json](licensing-policy.json) is the checked engineering inventory.
It does not override a third-party notice or a signed agreement, or replace a
license grant. Renaming a folder to `sdk` or `starter`, moving product code, or
adding a permissive dependency does not relicense that code. The current
`apacheScopes` list is deliberately empty: there is no standalone SDK/starter in
the inspected source. Existing `examples/` remain ELv2, not automatically Apache.

## What you can do

You may inspect the code, run it for your own internal business, modify it, keep
permitted modifications private, and redistribute copies subject to ELv2. A
contractor may charge for setting it up for a client's internal use when that
work is not providing a restricted hosted/managed service. Include the license,
preserve notices, and prominently identify modifications when distributing them.

ELv2 restricts providing third parties a hosted or managed service that exposes
any substantial set of the software's features or functionality. It also protects
license-key functionality and licensing/copyright/other notices. It is not a
blanket noncommercial license, a ban on all competitors, or a requirement to
contribute modifications upstream. The [full license](LICENSE) controls.

See the [usage examples](docs/licensing/usage-policy.md). Cloud account ownership,
a private repository, read-only UI access, or calling a service "consulting" does
not alone determine whether the hosted-service restriction applies.

## Commercial rights and customer applications

Additional hosted-service/OEM rights and support can be negotiated with Lumi's
authorized rights holder. Contact **hello@runlumi.app** with the delivery model.
Ordinary permitted commercial use does not require buying extra rights merely
because money changes hands. No price, SLA, trademark permission, waiver or
commercial license is granted by this summary.

The [partner/customer framework](docs/licensing/commercial-framework.md) records
proposed contracting principles, not an executed agreement. A permissive starter
will license only its own scaffolding, not the ELv2 core it imports. Private
customer repositories preserve the applicable core notices and do not transfer
customer IP to Lumi. Use independent private repos for confidential customer work;
do not assume a native fork of a public repository becomes private.

## Contributions and future Apache scopes

Read [CONTRIBUTING.md](CONTRIBUTING.md). Contributors retain their rights unless a
separate signed agreement says otherwise. Commercial relicensing authority is
not inferred from a PR, a DCO sign-off, a GitHub organization name or this policy.

An Apache scope needs a narrow purpose, provenance/rights review, explicit owner
approval, a local unmodified license, notices, correct package metadata and tests
of the actual distributed contents. Do not include product engines, auth,
canonical commerce/financial implementations or copied UI modules simply to make
a "starter" convenient. Use the [release checklist](docs/licensing/rights-review.md).

## Operational boundaries

This grant begins with revisions containing this license; it does not rewrite
historical tags, terminate previous grants, transfer third-party rights, or prove
an ownership audit has been completed. The existing RunLumi attribution is
preserved, not replaced with an unverified legal entity. Package `private: true`
is retained to prevent accidental registry publication; it is not a use license.

Software rights are distinct from hosted subscriptions, runtime entitlements,
Access authentication and paid support. This change neither provisions a free
managed service nor modifies entitlement enforcement. Self-hosting uses reviewed
provisioning documented in [deployment](docs/deployment.md); do not bypass gates.

Run `npm run check:licensing`. Application and marketing builds include the full
product terms as `LICENSE.txt`, attribution as `NOTICE.txt`, and their existing
third-party notices. Future Worker/package/customer distributions need their own
packaging checks; these two web checks do not certify all release channels.

## Primary references

Reviewed 2026-09-20. These explain the standard licenses; they are not legal advice
or authority to expand Lumi's grant.

- [Elastic License 2.0](https://www.elastic.co/licensing/elastic-license)
- [ELv2 FAQ and examples](https://www.elastic.co/licensing/elastic-license/faq)
- [Elastic on ELv2's non-copyleft and non-OSI status](https://www.elastic.co/blog/elastic-license-v2)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [GitHub fork visibility](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-permissions-and-visibility-of-forks)
