import User from "../models/user.model";
import { Response, Request, NextFunction } from "express";

export const Login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
console.log(req.oidc.user);
const user = await User.findOne({ UserID: req.oidc.user!.sub });
    if (!user) {
      const result = await User.create({
        UserID: req.oidc.user!.sub,
        Username: req.oidc.user!.name,
        Email: req.oidc.user!.email,
        EmailVerified: req.oidc.user!.email_verified,
        ProfileUrl: req.oidc.user!.picture,
      });
      if (result) {
        res.status(200).json({ message: "User created successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } else {
      res.status(200).json({ message: "Login Successful ✅✅✅" });
    }
  } catch (error:any) {
    next(error);
  }
};
