import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { Response, Request, NextFunction } from "express";
import { environment } from "../environments/endpoints.config";
import { verifyToken } from "../middleware/isAuthorized";

export const Login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log(req.oidc.user);
    const user = await User.findOne({ UserID: req.oidc.user!.sub });
    const token= jwt.sign({userID: req.oidc.user!.sub, userMail: req.oidc.user!.email},  `${environment.JWTKEY}`,{
        expiresIn:"7d"
    }
)

    if (!user) {
      const result = await User.create({
        UserID: req.oidc.user!.sub,
        Username: req.oidc.user!.name,
        Email: req.oidc.user!.email,
        EmailVerified: req.oidc.user!.email_verified,
        ProfileUrl: req.oidc.user!.picture,
      });
      if (result) {
        res.status(200).json({ message: "User created successfully", token:token});
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } else {
      res.status(200).json({ message: "Login Successful ✅✅✅", token:token });
    }
  } catch (error: any) {
    next(error);
  }
};

export const Logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.oidc.logout();
    res.status(200).json({ message: "logout successful" });
  } catch (error) {
    next(error);
  }
};

