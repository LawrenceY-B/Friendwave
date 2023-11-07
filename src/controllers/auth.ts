import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { Response, Request, NextFunction } from "express";
import { environment } from "../environments/endpoints.config";

export const Login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log(req.oidc.user);
    const user = await User.findOne({ Auth0ID: req.oidc.user!.sub });

    if (!user) {
      const result = await User.create({
        Auth0ID: req.oidc.user!.sub,
        Username: req.oidc.user!.name,
        Email: req.oidc.user!.email,
        EmailVerified: req.oidc.user!.email_verified,
        ProfileUrl: req.oidc.user!.picture,
      });
      if (result) {
        const token = jwt.sign(
          {
            Auth0id: req.oidc.user!.sub,
            userID: result?._id,
            userMail: req.oidc.user!.email,
          },
          `${environment.JWTKEY}`,
          {
            expiresIn: "7d",
          }
        );
        
        res
          .status(200)
          .json({ message: "User created successfully", token: token, userID: result?._id });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } else {
      const token = jwt.sign(
        {
          Auth0id: req.oidc.user!.sub,
          userID: user?._id,
          userMail: req.oidc.user!.email,
         
        },
        `${environment.JWTKEY}`,
        {
          expiresIn: "7d",
        }
      );
      res
        .status(200)
        .json({ message: "Login Successful ✅✅✅", token: token, userID: user?._id});
    }
  } catch (error) {
    next(error);
  }
};

export const Logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = {
      // sub: req.user.userID,
      iat: Date.now() / 1000,
      exp: 0,
    };

    const newToken = jwt.sign(payload, `${environment.JWTKEY}`);
    res.oidc.logout();

    // Respond with a success message and the new token
    return res.status(200).json({ message: "Logged out", token: newToken });
  } catch (error) {
    next(error);
  }
};
