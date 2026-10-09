import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import User from "../models/user.model";
import { Response, Request, NextFunction } from "express";
import { environment } from "../environments/endpoints.config";

// One place that decides what goes in a token, instead of two copies
const signToken = (auth0Id: string, userID: Types.ObjectId, email: string) =>
  jwt.sign({ Auth0id: auth0Id, userID, userMail: email }, environment.JWTKEY, {
    expiresIn: "7d",
  });

export const Login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // requiresAuth() on the route guarantees req.oidc.user is set
    const profile = req.oidc.user!;
    let user = await User.findOne({ Auth0ID: profile.sub });
    let message = "Login Successful ✅✅✅";

    if (!user) {
      // Pick the _id ourselves so UserID can be saved in the same write
      const _id = new Types.ObjectId();
      user = await User.create({
        _id,
        UserID: _id,
        Auth0ID: profile.sub,
        Name: profile.name ?? profile.nickname,
        Username: profile.nickname ?? profile.email.split("@")[0],
        Email: profile.email,
        EmailVerified: profile.email_verified,
        ProfileUrl: profile.picture,
      });
      message = "User created successfully";
    }

    const token = signToken(profile.sub, user._id, profile.email);
    res.status(200).json({ message, token, userID: user._id });
  } catch (error) {
    next(error);
  }
};

// Ends the Auth0 session (redirects to Auth0's logout page).
// Note: a JWT can't be "un-issued". Tokens already handed out stay valid until
// they expire, so the client must delete its copy of the token on logout.
export const Logout = (req: Request, res: Response) => {
  res.oidc.logout();
};
