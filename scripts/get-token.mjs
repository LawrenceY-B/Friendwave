// Gets an Auth0 access token for a test user, so you can call the API from
// Postman/curl without a frontend. Development only. See docs/AUTH.md.
//
//   npm run token -- alice@test.com 'S3cret-pass!'            existing user
//   npm run token -- alice@test.com 'S3cret-pass!' --signup   create the user first
//
// Prints only the token, so this works:  TOKEN=$(npm run -s token -- alice@test.com 'S3cret-pass!')
import dotenv from "dotenv";
dotenv.config({ quiet: true });

const [email, password, flag] = process.argv.slice(2);
const {
  ISSUERBASEURL,
  AUTH0_AUDIENCE,
  AUTH0_TEST_CLIENT_ID,
  AUTH0_TEST_CLIENT_SECRET,
  AUTH0_TEST_CONNECTION = "Username-Password-Authentication",
} = process.env;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!email || !password) fail("Usage: npm run token -- <email> <password> [--signup]");
for (const [name, value] of Object.entries({ ISSUERBASEURL, AUTH0_AUDIENCE, AUTH0_TEST_CLIENT_ID, AUTH0_TEST_CLIENT_SECRET })) {
  if (!value) fail(`Missing ${name} in .env (see docs/AUTH.md)`);
}
const issuer = ISSUERBASEURL.replace(/\/?$/, "/");

const post = async (path, body) => {
  const response = await fetch(new URL(path, issuer), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`${path} failed (${response.status}): ${data.error_description || data.description || data.message || JSON.stringify(data)}`);
  }
  return data;
};

if (flag === "--signup") {
  await post("dbconnections/signup", {
    client_id: AUTH0_TEST_CLIENT_ID,
    connection: AUTH0_TEST_CONNECTION,
    email,
    password,
  });
  console.error(`Created Auth0 user ${email}`);
}

const { access_token } = await post("oauth/token", {
  grant_type: "http://auth0.com/oauth/grant-type/password-realm",
  realm: AUTH0_TEST_CONNECTION,
  username: email,
  password,
  audience: AUTH0_AUDIENCE,
  scope: "openid profile email",
  client_id: AUTH0_TEST_CLIENT_ID,
  client_secret: AUTH0_TEST_CLIENT_SECRET,
});
console.log(access_token);
