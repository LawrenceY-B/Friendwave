import express, { NextFunction, Request, Response } from "express";
import { environment } from "./environments/endpoints.config";
import { createServer  } from "http";
import { Server as SocketIOServer  } from "socket.io";

import { DB_Connection } from "./database/db";
import { auth, requiresAuth } from "express-openid-connect";
import ErrorHandler from "./middleware/errorhandler";
import Authroutes from "./routes/auth.routes";
import UserRoutes from "./routes/user.routes";
import PostRoutes from "./routes/post.routes";
import StoryRoutes from "./routes/story.routes";
import { storycheck, logcheck } from "./jobs/story.jobs";
import Logger from "./lib/logger";
import morganMiddleware from "./middleware/debughandler";
import ChatRoutes from "./routes/chat.routes";
import MessageRoutes from "./routes/message.routes";
import SocketManager from "./controllers/socket";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer); 
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
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE"
    );
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
  .use("/api/users", UserRoutes)
  .use("/api/posts", PostRoutes)
  .use("/api/story", StoryRoutes)
  .use("/api/chat", ChatRoutes)
  .use("/api/messages", MessageRoutes);

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.all("*", (req: Request, res: Response) => {
  res.status(404).json({ message: "Page Not Found 😔" });
  Logger.http(`${req.method} - ${req.url} - ${req.ip} Page Not Found 🔦🔦`);
});

storycheck();
logcheck();
app.use(morganMiddleware);
app.use(ErrorHandler);

const socketManager = new SocketManager(io);


const server = httpServer.listen(environment.PORT, async () => {
  await DB_Connection();
  Logger.debug(`🚀🚀🚀Server is running on port ${process.env.PORT}`);
});



