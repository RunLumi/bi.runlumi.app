# Lumi BI customer user guide

This guide explains how to create, validate, and hand off a new customer application repository from the Lumi BI platform repository.

Read in order:

1. [Platform setup](01-platform-setup.md)
2. [Create a customer repository](02-create-customer-repository.md)
3. [Run the customer E2E workflow](03-customer-e2e.md)
4. [Deployment handoff](04-deployment-handoff.md)
5. [Core upgrades](05-upgrading-core.md)
6. [Standalone customer architecture](06-standalone-customer-architecture.md)

## Important boundaries

- npm run customer:new creates a local repository directory. It does not create a GitHub repository, Cloudflare resource, DNS record, Access application, secret, or database.
- Generated customers consume exact vendored @runlumi/* tarballs. They are independent repositories, not forks that patch core internals.
- Synthetic fixtures prove deterministic behavior only. They are not merchant certification or live provider evidence.
- deploy:plan is a review gate and creates no Cloudflare resource. A real deployment requires separately authorized operator work.

The source product is licensed under Elastic License 2.0. Review LICENSING.md and the customer-facing commercial terms before distributing or hosting a customer application.
