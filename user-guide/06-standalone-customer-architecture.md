# Installation architecture

Every repository is an independent Lumi BI installation. Its users, sessions,
roles, D1 data, private R2 objects, dashboards, reports and audit records stay
inside that repository's deployed resources. Shared core packages are build-time
dependencies only.

The installation can continue operating while Lumi-operated endpoints are
unavailable. Optional external identity or release checks may improve operations,
but they are not authorities for data access and their outage must not expose data
or stop the application from running.
