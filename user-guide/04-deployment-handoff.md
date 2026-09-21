# 4. Deployment handoff

Deployment is a separate operator-controlled phase. Do not treat repository generation or a dry-run as deployment.

## Customer-side release gate

Inside the customer repository:

    npm run validate
    npm run build
    npm run deploy:plan production
    npm run deploy:plan staging

deploy:plan must fail while the hostname, Access team, audience, or D1 identity is still a scaffold value. Review the inventories under infra/environments/ only after real resources and Access configuration have been approved.

Set hostnameReviewed: true only for the reviewed custom hostname protected by Access. Never commit secrets.

## Operator handoff sequence

The authorized operator must:

1. Register the customer deployment at the control plane (POST /control/admin/deployments).
2. Confirm the registered Access team/audience and control API version match the reviewed inventory.
3. Apply core migrations from node_modules/@runlumi/core/migrations.
4. Apply customer migrations from customer/migrations.
5. Deploy the private control Worker before the customer Worker.
6. Deploy the customer Worker:

       npx wrangler deploy --config apps/worker/wrangler.jsonc
       npx wrangler deploy --config apps/worker/wrangler.jsonc --env staging

7. Verify Access protects the hostname and SPA routes.
8. Verify /healthz, the serving D1 serving_identity, source bindings, and control authorization.
9. Run authenticated browser/API smoke tests against the real hostname.

## Evidence to record

Record separately:

- repository commit and hosted CI checks;
- deployment plan and operator review;
- control/deployment registration ID and lifecycle state;
- migration results and rollback plan;
- authenticated hostname/API/browser results;
- source-provider authorization, coverage, reconciliation, and merchant sign-off.

HTTP 200, a successful Wrangler dry-run, a configured provider label, or a passing synthetic fixture is not proof of live commerce completeness. If any external prerequisite is missing, state it explicitly and keep the release non-certified.
