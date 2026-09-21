# Lumi BI operator guide

This guide is one coherent operator journey for one Lumi BI installation: an
independently operated, customer-deployable reporting application. Each
installation owns exactly one Worker, one hostname, one D1 database, one
private R2 bucket and all of its local users, sessions, roles and audit
history. No Lumi-operated service participates at request time.

Read in order:

1. [Requirements and supported capabilities](01-requirements-and-capabilities.md)
2. [Create your repository](02-create-your-repository.md)
3. [Configure database, storage, hostname and secrets](03-configure-resources.md)
4. [Initialize and create the administrator](04-initialize-and-administrator.md)
5. [Sign in and run locally](05-sign-in-and-run-locally.md)
6. [Deploy staging and production](06-deploy-staging-and-production.md)
7. [Add users and assign roles](07-users-and-roles.md)
8. [Connect, import data and resolve import errors](08-connect-import-and-errors.md)
9. [Publish, query and use reports and decisions](09-publish-query-reports-decisions.md)
10. [Customize pages, reports and server behavior](10-customize.md)
11. [Update core and apply migrations](11-update-core-and-migrations.md)
12. [Back up, restore and roll back](12-backup-restore-rollback.md)
13. [Troubleshooting and operational handoff](13-troubleshooting-and-handoff.md)

## Important boundaries

- Every command in this guide runs against **your own** Cloudflare resources.
  The guide creates no GitHub repository, DNS record, Access application or
  billable resource by itself; steps that do require them are marked explicitly.
- Generated customer repositories consume exact, checksum-verified `@runlumi/*`
  tarballs. They are independent repositories, not forks that patch core
  internals.
- Synthetic fixtures prove deterministic behavior only. No live connector
  (Nhanh, Haravan, Shopee) integration or certification exists or is claimed;
  the supported transport is **owner-authorized exports** you upload.
- `deploy:plan` is a review gate and creates no Cloudflare resource. A real
  deployment requires separately authorized operator work.

The product is source-available under [Elastic License 2.0](../LICENSE). Review
[LICENSING.md](../LICENSING.md) and [TRADEMARKS.md](../TRADEMARKS.md) before
distributing or hosting a customer application.
