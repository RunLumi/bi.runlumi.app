# 4. Initialize and create the administrator

First-run setup is available only while the installation is uninitialized.
After the administrator exists, setup closes permanently.

## Initialize through the app

1. Open your installation hostname (or the local dev server).
2. The app detects a fresh installation and shows **Khởi tạo cài đặt Lumi BI**
   (first-run setup).
3. Fill in:
   - installation name;
   - administrator email and password (minimum 10 characters);
   - display name.
4. If the deployment configured the `SETUP_TOKEN` secret, paste the token into
   the setup-token field. Setup refuses without it (`SETUP_TOKEN_REQUIRED`).
5. Submit. The app creates the installation row and the first `owner` user,
   signs you in, and setup closes permanently.

## Protection guarantees (tested)

- **Permanent closure** — the installation row's singleton primary key makes
  setup a one-time event. Replaying setup returns 409
  `INSTALLATION_ALREADY_INITIALIZED`.
- **Concurrent initialization** — two simultaneous setup calls produce exactly
  one winner; the loser receives 409. The database can never hold two
  installation rows.
- **Takeover protection** — with `SETUP_TOKEN` configured, setup without the
  token returns 403 `SETUP_TOKEN_REQUIRED`. Set the secret **before** the first
  public deployment.
- **Password storage** — PBKDF2-SHA-256 with a per-user random salt and
  210,000 iterations; passwords are never stored or logged in clear.

## Initialize through the API (optional)

```bash
curl -X POST https://your-hostname/api/setup \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","login":"admin@acme.vn","displayName":"Acme Admin","password":"a-long-password","setupToken":"<SETUP_TOKEN>"}'
```

The response sets an HttpOnly `lumi_session` cookie and returns the created
user. `GET /api/setup/status` reports `{"initialized":true|false}` at any time.

## Recovery if the administrator is lost

The application refuses to disable or demote the **last active owner**
(`LAST_ACTIVE_OWNER`), so accidental lockout cannot happen through the app. If
all administrator credentials are truly lost, restore from a database backup
taken before the loss (chapter 12). There is deliberately no back door.

Continue to [Sign in and run locally](05-sign-in-and-run-locally.md).
