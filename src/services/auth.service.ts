import { Types } from "mongoose";
import User, { USERNAME_COLLATION } from "../models/user.model";
import { fetchUserInfo, verifyAccessToken } from "../lib/auth0";

// What controllers see as req.user
export interface AuthUser {
  Auth0id: string;
  userID: string;
  userMail?: string;
}

export const isUsernameTaken = async (username: string) =>
  (await User.exists({ Username: username }).collation(USERNAME_COLLATION)) !== null;

// Returns `base` if free, otherwise `base` plus a random number, e.g. lawrence4821
const pickUsername = async (base: string) => {
  if (!(await isUsernameTaken(base))) return base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await isUsernameTaken(candidate))) return candidate;
  }
  return `${base}_${new Types.ObjectId().toString().slice(-8)}`;
};

// Returns the user for this Auth0 id, creating it on their first request.
const findOrCreateUser = async (auth0Id: string, token: string) => {
  const existing = await User.findOne({ Auth0ID: auth0Id });
  if (existing) return existing;

  const profile = await fetchUserInfo(token);
  // Apple and some social logins may hide the name and email, so always have a fallback
  const base = profile.nickname || profile.email?.split("@")[0] || "user";

  // Retry if another request grabbed the same username in the meantime
  for (let attempt = 0; attempt < 3; attempt++) {
    const _id = new Types.ObjectId();
    const username = await pickUsername(base);
    try {
      return await User.create({
        _id,
        UserID: _id,
        Auth0ID: auth0Id,
        Name: profile.name || username,
        Username: username,
        Email: profile.email,
        EmailVerified: profile.email_verified,
        ProfileUrl: profile.picture,
      });
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      // Two first requests at the same moment: the unique index on Auth0ID
      // rejects the second insert, so just load the user the first one created.
      if (error.keyPattern?.Auth0ID) {
        const user = await User.findOne({ Auth0ID: auth0Id });
        if (user) return user;
      }
      // Otherwise the username was taken between our check and the insert: try again
    }
  }
  throw new Error("Could not create user: no free username found");
};

// Used by both the HTTP middleware and the socket handshake
export const authenticate = async (token: string): Promise<AuthUser> => {
  const payload = await verifyAccessToken(token);
  const user = await findOrCreateUser(payload.sub, token);
  return { Auth0id: payload.sub, userID: user._id.toString(), userMail: user.Email };
};
