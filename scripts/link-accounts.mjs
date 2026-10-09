// Links Auth0 identities so one person gets one account whichever way they log
// in (see docs/AUTH.md → Account linking). After linking, every login method
// returns the primary's `sub`.
//
//   node scripts/link-accounts.mjs <primarySub> <secondarySub>
//   e.g. node scripts/link-accounts.mjs google-oauth2|1181… apple|000616.71…
//
// Needs a Machine-to-Machine application authorized for the "Auth0 Management API"
// with the read:users and update:users permissions, in .env:
//   AUTH0_MGMT_CLIENT_ID=...
//   AUTH0_MGMT_CLIENT_SECRET=...
// If both identities already have Friendwave accounts, merge them afterwards
// with scripts/merge-users.mjs.
import dotenv from "dotenv";
dotenv.config({ quiet: true });

const [primary, secondary] = process.argv.slice(2);
const { ISSUERBASEURL, AUTH0_MGMT_CLIENT_ID, AUTH0_MGMT_CLIENT_SECRET } = process.env;
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!primary?.includes("|") || !secondary?.includes("|")) fail("Usage: node scripts/link-accounts.mjs <primarySub> <secondarySub>");
if (!AUTH0_MGMT_CLIENT_ID || !AUTH0_MGMT_CLIENT_SECRET) fail("Missing AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET in .env");
const issuer = ISSUERBASEURL.replace(/\/?$/, "/");

const call = async (method, path, body, token) => {
  const response = await fetch(new URL(path, issuer), {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) fail(`${method} ${path} failed (${response.status}): ${data.message || data.error_description || JSON.stringify(data)}`);
  return data;
};

// A token for Auth0's own Management API (the /api/v2/ audience)
const { access_token } = await call("POST", "oauth/token", {
  grant_type: "client_credentials",
  client_id: AUTH0_MGMT_CLIENT_ID,
  client_secret: AUTH0_MGMT_CLIENT_SECRET,
  audience: `${issuer}api/v2/`,
});

const [provider, ...rest] = secondary.split("|");
const identities = await call(
  "POST",
  `api/v2/users/${encodeURIComponent(primary)}/identities`,
  { provider, user_id: rest.join("|") },
  access_token
);
console.log(`✅ Linked. ${primary} now has identities: ${identities.map((i) => i.provider).join(", ")}`);
