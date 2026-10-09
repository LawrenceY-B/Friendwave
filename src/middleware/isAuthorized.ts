import { NextFunction, Request, Response } from "express";
import { errors } from "jose";
import { authenticate, AuthUser } from "../services/auth.service";
import Logger from "../lib/logger";

//this module extends Request to create a new object, in this case, the user object
declare module "express-serve-static-core" {
  interface Request {
    user: AuthUser;
  }
}

// Expects "Authorization: Bearer <Auth0 access token>". The first request from a
// new Auth0 user creates their Friendwave account automatically.
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const Authorization = req.get("Authorization");
  if (!Authorization || !Authorization.startsWith("Bearer ")) {
    Logger.warn("Invalid Authorization header");
    // `return` stops the function here; without it the code below still runs.
    return res.status(401).json({ success: false, message: "Invalid Authorization header" });
  }

  try {
    req.user = await authenticate(Authorization.slice("Bearer ".length));
  } catch (error: any) {
    // Problems with the token itself are the client's fault (401). A timeout while
    // downloading Auth0's keys, or a database error, is ours: pass it on.
    if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
      Logger.warn(`Rejected token: ${error.code}`);
      const message =
        error instanceof errors.JWTExpired ? "Token has expired" : "Invalid access token";
      return res.status(401).json({ success: false, message });
    }
    return next(error);
  }
  // Outside the try, so errors from later handlers aren't treated as token errors
  next();
};
