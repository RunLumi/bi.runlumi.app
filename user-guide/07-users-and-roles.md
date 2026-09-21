# 7. Add users and assign roles

All identity data is local to the installation. Roles are hierarchical:
`viewer` (read published data) < `editor` (manage sources, dashboards,
snapshots) < `owner` (users, sources authorization, commerce evidence,
publications, decisions, exports).

## Create a user (owner only)

In the app: **Quản trị** (Administration) → *Tạo người dùng*. Provide email,
display name, role and an initial password (minimum 10 characters). Local users
always require a credential; creating a local user without a password fails
with `PASSWORD_REQUIRED`.

Through the API:

```bash
curl -X POST https://your-hostname/api/users \
  -H 'content-type: application/json' -b 'lumi_session=<owner session>' \
  -d '{"login":"analyst@acme.vn","displayName":"Analyst","role":"editor","password":"a-long-password"}'
```

External identities (optional Cloudflare Access) are added the same way with
their issuer/subject instead of `login`; they never receive a local password.

## Change roles and disable users

Role changes and disable/enable are `PUT /api/users/<id>` with `{role}` or
`{state}`. Disabling a user:

- revokes **all** of that user's sessions immediately;
- blocks sign-in with `USER_DISABLED`;
- blocks every data, export and saved-result surface server-side (chapter 9
  proves exports and saved reports are denied after revocation).

Re-enabling restores the previous credential; the owner can also reset a
password with `PUT /api/users/<id>` `{password}`.

## Last-administrator protection

The last active `owner` cannot be disabled or demoted (`LAST_ACTIVE_OWNER`).
Create a second owner before demoting or disabling the first.

## User-initiated password change

Any signed-in user changes their own password with
`POST /api/auth/password` `{currentPassword, newPassword}`; the current
password is required and verified.

## Test the boundaries (recommended after setup)

1. Sign in as the new viewer in a private window; owner pages are absent from
   navigation and owner APIs return 403.
2. Disable the viewer; confirm their existing session stops working at once.
3. Attempt sign-in with a wrong password; confirm a single generic error.

Continue to [Connect, import data and resolve import errors](08-connect-import-and-errors.md).
