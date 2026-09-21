# 0002: Cloudflare resource roles

The Worker serves the React assets and API. D1 stores bounded indexed application
data. R2 stores private immutable source objects. Bindings are fixed per
installation and request handling never calls the Cloudflare management API.

Add Queues, Workflows, or analytical adapters only after a measured workload and
an explicit test justify their cost and failure model.
