import { Types } from "mongoose";
import User from "../models/user.model";
import { fetchUserInfo, verifyAccessToken } from "../lib/auth0";

// What controllers see as req.user
export interface AuthUser {
  Auth0id: string;
  userID: string;
  userMail?: string;
}

// Returns the user for this Auth0 id, creating it on their first request.
const findOrCreateUser = async (auth0Id: string, token: string) => {
  const existing = await User.findOne({ Auth0ID: auth0Id });
  if (existing) return existing;

  const profile = await fetchUserInfo(token);
  const _id = new Types.ObjectId();
  // Apple and some social logins may hide the name and email, so always have a fallback
  const username =
    profile.nickname || profile.email?.split("@")[0] || `user_${_id.toString().slice(-6)}`;
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
    // Two first requests at the same moment: the unique index on Auth0ID
    // rejects the second insert, so just load the user the first one created.
    if (error.code === 11000) {
      const user = await User.findOne({ Auth0ID: auth0Id });
      if (user) return user;
    }
    throw error;
  }
};

// Used by both the HTTP middleware and the socket handshake
export const authenticate = async (token: string): Promise<AuthUser> => {
  const payload = await verifyAccessToken(token);
  const user = await findOrCreateUser(payload.sub, token);
  return { Auth0id: payload.sub, userID: user._id.toString(), userMail: user.Email };
};
