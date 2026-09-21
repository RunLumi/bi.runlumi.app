# 6. Standalone customer architecture

Each generated customer application is intended to run as its own application and data plane. The customer owns the Worker, hostname, Access application, serving D1, private source bucket, users, memberships, entitlements, migrations, reports, connectors and audit records.

The customer Worker does not require a CONTROL service binding. Its request path is:

    Browser -> customer Worker -> customer-owned serving D1/R2

Cloudflare Access authenticates the user against the customer’s own identity configuration. The serving database stores local memberships and entitlements. The Worker checks the verified principal, customer deployment identity, membership, role, entitlement, route epoch, and serving database identity before serving data.

The local authority surfaces are:

    GET  /api/session
    GET  /api/tenants/<customer>/members
    POST /api/tenants/<customer>/members

Membership writes require an owner and are audited in the customer database. A membership can be set to active or revoked. Entitlements are stored per customer and contain the locally approved feature set.

## What the shared core does

The upstream repository supplies versioned packages and migrations. A customer consumes exact packaged artifacts and upgrades them through a reviewed Git diff. The shared core does not need to be reachable at request time.

## Local proof

Generate two customers and run:

    npm run core:pack
    npm run acceptance:two-customers

The acceptance must prove that both generated applications install from packaged artifacts, have different customer code, compile and test independently, retain customizations through a core upgrade, and can roll one customer back without changing the other.

## Deployment boundary

The customer can deploy into its own Cloudflare account without registering with a Lumi-operated control service. A real deployment still needs customer-owned Cloudflare resources, Access setup, secrets, migrations, and operator review. Local and hosted tests prove application behavior; they do not prove a live provider or production deployment.
