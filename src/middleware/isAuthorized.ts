import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Schema } from "mongoose";
import { environment } from "../environments/endpoints.config";
import Logger from "../lib/logger";

//this module extends Request to create a new object, in this case, the user object
declare module "express-serve-static-core" {
  interface Request {
    user: {
      //    Properties of token payload
      Auth0id: string;
      userID: Schema.Types.ObjectId;
      userMail: string;
      iat: number;
      exp: number;
    };
  }
}

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const Authorization = req.get("Authorization");
  if (!Authorization || !Authorization.startsWith("Bearer ")) {
    res.status(401).json({ message: "Invalid Authorization header" });
    Logger.warn("Invalid Authorization header");
  }

  const token: string = Authorization!.split(" ")[1];
  try {
    const payload: any = jwt.verify(token, environment.JWTKEY || "");

    if (!payload) {
      res.status(401).json({ message: "Invalid access token" });
      Logger.warn("Invalid access token");
    }

    // check expiry
    if (payload.exp < Date.now() / 1000) {
      res.status(401).json({ message: "Token has expired" });
      Logger.warn("Token has expired");
    }
    req.user = payload;
    next();
  } catch (error) {
    next(error);
    Logger.warn(error);
  }
};
