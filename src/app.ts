import express, { NextFunction, Request, Response } from "express";
import { environment } from "./environments/endpoints.config";
import { Server } from "http";
import { DB_Connection } from "./database/db";
import { auth, requiresAuth } from "express-openid-connect";
import ErrorHandler from "./middleware/errorhandler";
import Authroutes from "./routes/auth.routes";
import UserRoutes from "./routes/user.routes";

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
  .use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    next();
  })
  .use(express.json())
  .use(auth(config))
  .use("/api", Authroutes)
  .use("/api/users", UserRoutes);

// auth router attaches /login, /logout, and /callback routes to the baseURL

app.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).send(req.oidc.isAuthenticated());
  } catch (error) {
    next(error);
  }
});

app.all("*", (req: Request, res: Response) => {
  res.status(404).json({ message: "Page Not Found 😔" });
});
app.use(ErrorHandler);

const server: Server = app.listen(environment.PORT, async () => {
  await DB_Connection();
  console.log(`🚀🚀🚀Server is running on port ${process.env.PORT}`);
});
