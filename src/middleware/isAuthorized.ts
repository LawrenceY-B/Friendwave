import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { environment } from "../environments/endpoints.config";

//this module extends Request to create a new object, in this case, the user object
declare module "express-serve-static-core" {
  interface Request {
    user: {
      //    Properties of token payload
      userID: string;
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
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    res.status(401).json({ message: "Invalid Authorization header" });
  }

  const token: string = authorization!.split(" ")[1];
  try {
    const payload: any = jwt.verify(token, environment.JWTKEY || "");

    if (!payload) res.status(401).json({ message: "Invalid access token" });

    // check expiry
    if (payload.exp < Date.now() / 1000) {
      res.status(401).json({ message: "Token has expired" });
    }
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};
