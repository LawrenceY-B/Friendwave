import express, { NextFunction, Request, Response } from "express";
import { environment } from "./environments/endpoints.config";
import { Server } from "http";
import { DB_Connection } from "./database/db";
import { auth, requiresAuth } from "express-openid-connect";
import { ErrorHandler } from "./middleware/errorhandler";
import Authroutes from "./routes/auth.routes";

const app = express();
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: `${environment.AUTH0SECRET}`,
  baseURL: `${environment.AUTH0BASEURL}`,
  clientID: `${environment.AUTH0CLIENTID}`,
  issuerBaseURL: `${environment.ISSUERBASEURL}`,
};
app
  .use(express.json())
  .use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    next();
  })
  .use(auth(config))
  .use(ErrorHandler)
  .use("/api", Authroutes)

// auth router attaches /login, /logout, and /callback routes to the baseURL

app.get( "/",async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.send(`Hello ${req.oidc.user!.name}, this is the admin section.`)
      console.log(req.oidc.user) 
    } catch (error) {
      next(error);
    }
  }
);

app.all("*", (req: Request, res: Response) => {
  res.status(404).json({ message: "Page Not Found 😔" });
});

const server: Server = app.listen(environment.PORT, async () => {
  await DB_Connection();
  console.log(`🚀🚀🚀Server is running on port ${process.env.PORT}`);
});
