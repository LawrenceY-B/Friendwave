# Authentication

## How it works

```
Frontend ──login──▶ Auth0 ──access token──▶ Frontend
Frontend ──"Authorization: Bearer <token>"──▶ Friendwave API
                                               ├─ verifies the token with Auth0's public keys
                                               └─ first request from a new user → creates their account
```

- The **frontend** logs users in with an Auth0 SDK and asks for an access token for this API
  (the *audience*). The API never sees passwords and keeps no secrets of its own.
- `middleware/isAuthorized.ts` verifies every request: signature (RS256, Auth0's public keys),
  issuer (your tenant), audience (this API) and expiry. Then it sets `req.user = { userID, Auth0id, userMail }`.
- **New users:** if no Friendwave user has that Auth0 id yet, the API calls Auth0's `/userinfo`
  for their name, email and picture and creates the account (`services/auth.service.ts`). There's no
  separate "register" step. The username comes from their Auth0 nickname (or email); if it's taken,
  a number is added (`lawrence` → `lawrence4821`). Apple users who hide their name/email start from `user`.
- **Usernames are unique, ignoring case**: a unique index with a case-insensitive collation on
  `Username`. Renaming to a taken username returns **409**.
- **Sockets** use the same token: `io(API_URL, { auth: { token } })`.
- **Logout** happens in the frontend (Auth0 SDK `logout()`). Access tokens are short-lived (24h by
  default; set "Token Expiration" on the API in Auth0).

Code: `lib/auth0.ts` (verify token, fetch profile), `services/auth.service.ts` (find or create the user),
`middleware/isAuthorized.ts` (HTTP), `controllers/socket.ts` (sockets).

## One-time Auth0 setup

1. **Create the API.** Auth0 Dashboard → Applications → **APIs** → Create API
   - Name: `Friendwave API`
   - Identifier: e.g. `https://api.friendwave` (just a unique name; it's never called)
   - Signing algorithm: RS256
   - Put the identifier in `.env` as `AUTH0_AUDIENCE`.
2. **`.env` changes:**
   ```diff
   - JWTKEY=...
   - AUTH0SECRET=...
   - AUTH0CLIENTID=...
   - AUTH0BASEURL=...
   + AUTH0_AUDIENCE=https://api.friendwave
   + API_URL=http://localhost:4000        # optional, this is the default
     ISSUERBASEURL=https://dev-xxxx.us.auth0.com   # unchanged
   ```

## Testing with new users (no frontend needed)

`npm run token` gets a real access token for a test user, for use in Postman or curl.

**Setup (once):**

1. Auth0 → Applications → **Create Application** → *Regular Web Application*, named
   `Friendwave Test (dev only)`.
   - Settings → Advanced Settings → **Grant Types** → tick **Password** → Save.
   - **Connections** tab → make sure `Username-Password-Authentication` is on.
2. Add its credentials to `.env` (development only, never on Render):
   ```
   AUTH0_TEST_CLIENT_ID=...
   AUTH0_TEST_CLIENT_SECRET=...
   ```
3. If you want `--signup` to work: Authentication → Database → `Username-Password-Authentication`
   → make sure **Disable Sign Ups** is off. (Or create users by hand under User Management → Users.)

**Use:**

```bash
# create a brand-new Auth0 user and get a token for them
TOKEN=$(npm run -s token -- alice@test.com 'Str0ng-pass!' --signup)

# later: token for an existing user
TOKEN=$(npm run -s token -- alice@test.com 'Str0ng-pass!')

# first call creates alice's Friendwave account
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/users/me
```

Make two or three users (alice, bob, carol) to test follows, chats and permissions between them.
In Postman, paste the token under Authorization → Bearer Token.

If the token request fails with *"Client is not authorized to access …"*, open the API in Auth0 →
**Application Access** (or *Machine to Machine / Applications* on older dashboards) and allow the test app.

> Before going live: delete the test application, or at least untick its Password grant.

## Frontend

See [API.md → Using it from Next.js](API.md#using-it-from-nextjs). In short: a **Regular Web
Application** in Auth0 for the Next app, authorized on Friendwave API, with `audience` set to
`AUTH0_AUDIENCE` and `scope: "openid profile email"`.

## Automated tests

`npm test` needs no Auth0 at all. `test/helpers.ts` starts a tiny fake issuer that serves
`/.well-known/jwks.json` and `/userinfo`, signs tokens with its own key, and points `ISSUERBASEURL`
at it. The tests check that wrong-audience, wrong-issuer, unknown-key, expired and garbage tokens are
rejected, and that simultaneous first requests create exactly one user.

## Account linking (one person, several logins)

Each login method (Google, Apple, email + password) is a separate Auth0 user with its own `sub`,
so it gets its own Friendwave account. To give a person one account:

1. **Link the identities in Auth0.** Choose the primary (the one whose Friendwave account has the data)
   and attach the others with the Management API:
   ```bash
   node scripts/link-accounts.mjs <primarySub> <secondarySub>    # e.g. google-oauth2|… apple|…
   ```
   This needs a Machine-to-Machine application authorized for the *Auth0 Management API*
   (`read:users`, `update:users`), with `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET` in `.env`.
   After linking, every login method returns the primary `sub`.
2. **Merge the Friendwave accounts.** The secondary accounts are now orphaned, so merge them:
   ```bash
   node scripts/merge-users.mjs <primaryUserId> <secondaryUserId> [...]          # dry run
   node scripts/merge-users.mjs <primaryUserId> <secondaryUserId> [...] --apply  # for real
   ```
   It moves posts, comments, replies, likes, saves, stories, follows, chats and messages to the primary.
   It drops what would become a self-follow, a chat with yourself, or a duplicate. It runs in a transaction
   and writes a backup to `backups/` (gitignored, since it contains user data).

If you link automatically by email (a post-login Action), only link when **both** emails are verified.
Otherwise someone could sign up with your address and take over your account.
