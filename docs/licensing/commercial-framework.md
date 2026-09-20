# Commercial partner and customer framework

**Proposed contracting policy, not an executable license, offer or signed
contract.** Standard ELv2 rights remain governed by [LICENSE](../../LICENSE).
Additional grants require a written agreement executed by authorized parties.
This document neither assigns existing IP nor grants hosted-service/OEM rights.
Have software-licensing counsel review the actual agreements before use.

## Partners: charge for additional rights and service

Ordinary installation and customization within ELv2 do not automatically require
a partner license. Offer additional rights when the partner needs to host or
operate substantial Lumi BI functionality for customers, receive specified OEM
rights, or obtain specific branding permissions outside existing rights.

Each agreement must specify:
- Actual legal parties and their authority; covered products, versions, modules,
  territory, permitted customers/users, hosting and distribution model.
- Precise extra rights, any permitted sublicensing, customer notices, trademark
  treatment and attribution. A "white label" checkbox cannot erase legal notices.
- Commercial basis, reporting/metering, payment, taxes, support, security patches,
  compatibility, end-of-life, service levels and fair audit procedures.
- Customer isolation, data processing/retention, credential handling, incident
  responsibilities, permitted subprocessors and access controls.
- Term, renewal, termination, transition assistance, retained customer rights,
  limits of liability, warranty/indemnity, disputes and governing law.

Do not advertise fixed partner prices, perpetual hosting, indemnity or an SLA
until actually approved. Lumi can grant only rights it owns or is authorized to
grant; third-party obligations remain. ELv2 contribution rights alone must not be
assumed to permit sublicensing under a different commercial license.

## Customer applications: separate four buckets

| Bucket | Proposed allocation to put into the signed agreement |
| --- | --- |
| Pre-existing Lumi core and reusable platform assets | Remain with their rights holders; grant the customer's specified use/maintenance rights |
| Customer data, credentials and confidential materials | No IP transfer to Lumi; limited processing/access rights for the agreed service |
| Original bespoke deliverables | Explicit assignment or durable license, identified deliverable by deliverable; not presumed from who pays or hosts Git |
| General reusable improvements | Express allocation and reuse rights, excluding customer secrets, datasets and restricted third-party work |

The agreement should let a customer export its data and appoint another permitted
maintainer. State which software may continue to run after service termination,
which hosted/premium rights expire, and any maintenance, escrow or transition
commitments. Do not promise rights over third-party components that Lumi cannot
grant. Customer-specific implementations are not automatically all owned by Lumi.

## Product policy

Keep essential authentication, isolation, safe data handling and available export
capabilities in the maintained product rather than deliberately weakening them
to force an upgrade. Sell deployment quality, support, managed operations,
additional modules and clearly defined rights. This is a design principle, not
a claim all target features or a free hosted plan already exist.

Future private modules must be separately identified when delivered. A directory
name such as `enterprise` does not silently revoke ELv2 rights already granted
for published code. Any different future grant needs explicit review, provenance,
notices and compatible packaging.

Reference: [ELv2](https://www.elastic.co/licensing/elastic-license), especially
Copyright License, Limitations and No Other Rights; reviewed 2026-09-20. This
framework does not amend that license or authorize customer-system side effects.
