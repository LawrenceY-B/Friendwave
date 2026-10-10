import { createRemoteJWKSet, jwtVerify } from "jose";
import { environment } from "../environments/endpoints.config";

// Auth0 signs access tokens with a private key and publishes the matching
// public keys here. jose downloads and caches them, so no shared secret is needed.
const JWKS = createRemoteJWKSet(
  new URL(".well-known/jwks.json", environment.AUTH0_ISSUER)
);

// Throws if the token is forged, expired, from another tenant (issuer) or
// meant for another API (audience). Only RS256 is accepted.
export const verifyAccessToken = async (token: string) => {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: environment.AUTH0_ISSUER,
    audience: environment.AUTH0_AUDIENCE,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "exp"],
  });
  return payload as typeof payload & { sub: string };
};

export interface Auth0Profile {
  sub: string;
  name?: string;
  nickname?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

// Access tokens don't contain the user's name/email, so ask Auth0 for them.
// Works when the frontend requested the "openid profile email" scopes.
export const fetchUserInfo = async (token: string): Promise<Auth0Profile> => {
  const response = await fetch(new URL("userinfo", environment.AUTH0_ISSUER), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const statusCode = response.status === 401 ? 401 : 502;
    throw Object.assign(
      new Error(
        statusCode === 401
          ? // Auth0 refused the token: usually the account was deleted (or the login expired), or the
            // client didn't ask for the "openid profile email" scopes
            "This login is no longer valid. Please log in again."
          : `Auth0 userinfo request failed (${response.status})`
      ),
      { statusCode }
    );
  }
  return (await response.json()) as Auth0Profile;
};
