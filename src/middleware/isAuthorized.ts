import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { environment } from "../environments/endpoints.config";
import Logger from "../lib/logger";

export interface TokenPayload {
  Auth0id: string;
  userID: string;
  userMail: string;
  iat: number;
  exp: number;
}

//this module extends Request to create a new object, in this case, the user object
declare module "express-serve-static-core" {
  interface Request {
    user: TokenPayload;
  }
}

export const verifyToken = (
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

  const token = Authorization.split(" ")[1];
  try {
    // jwt.verify throws if the signature is wrong OR the token has expired,
    // so no separate expiry check is needed.
    req.user = jwt.verify(token, environment.JWTKEY) as TokenPayload;
    next();
  } catch (error: any) {
    Logger.warn(`Rejected token: ${error.message}`);
    const message =
      error instanceof jwt.TokenExpiredError ? "Token has expired" : "Invalid access token";
    return res.status(401).json({ success: false, message });
  }
};
