# 5. Sign in and run locally

## Direct sign-in

1. Open the installation. Initialized installations show the sign-in screen.
2. Enter your email and password. Sessions are HttpOnly, `SameSite=Lax`,
   `Secure` cookies valid for 14 days; every protected request revalidates the
   session server-side against the local `sessions` table.
3. **Đăng xuất** (sign out) deletes the server-side session immediately and
   clears the client cache. Disabling a user (chapter 7) revokes all of that
   user's sessions at once.

Wrong credentials return a single `INVALID_CREDENTIALS` error without
revealing whether the account exists. Cross-site form posts are rejected
(`CROSS_ORIGIN_DENIED`).

Cloudflare Access, if configured, is verified **in addition**: an Access JWT is
accepted only when it matches the configured team and audience AND a local user
exists for that identity. Access never replaces the local user model.

## Run locally against synthetic data (demo mode)

```bash
# working directory: the Lumi BI platform repository
npm run build:web   # once per code change
npm run dev
```

Open `http://127.0.0.1:8787`. The server binds to loopback only and seeds a
synthetic installation with demo users, so you can explore the UI quickly. The
DEMO switcher changes identities — this convenience exists only in demo mode.

## Run locally against a fresh installation (strict mode)

```bash
# working directory: the Lumi BI platform repository
npm run dev -- --strict
```

Strict mode starts with an empty schema and no users. You walk the real
journey: setup, sign-in, user management, imports. Demo headers are never
accepted in strict mode, exactly like production.

## Local runtime check under workerd

```bash
# working directory: the Lumi BI platform repository
npm run core:pack
node scripts/workerd-check.mjs
```

This installs the packaged tarballs into a temp directory, applies the real
installation migrations to a local D1 database and runs the Worker under real
workerd: setup, sign-in, fail-closed authentication and asset serving. No
Cloudflare account or billable resource is used.

Continue to [Deploy staging and production](06-deploy-staging-and-production.md).
