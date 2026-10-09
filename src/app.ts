import express, { NextFunction, Request, Response } from "express";
import { environment } from "./environments/endpoints.config";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

import { DB_Connection } from "./database/db";
import { auth } from "express-openid-connect";
import ErrorHandler from "./middleware/errorhandler";
import Authroutes from "./routes/auth.routes";
import UserRoutes from "./routes/user.routes";
import PostRoutes from "./routes/post.routes";
import StoryRoutes from "./routes/story.routes";
import MediaRoutes from "./routes/media.routes";
import { storycheck, logcheck } from "./jobs/story.jobs";
import Logger from "./lib/logger";
import morganMiddleware from "./middleware/debughandler";
import ChatRoutes from "./routes/chat.routes";
import MessageRoutes from "./routes/message.routes";
import SocketManager from "./controllers/socket";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: environment.CLIENT_ORIGIN },
});
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: environment.AUTH0SECRET,
  baseURL: environment.AUTH0BASEURL,
  clientID: environment.AUTH0CLIENTID,
  issuerBaseURL: environment.ISSUERBASEURL,
};
app
  // Middleware runs in the order it is registered, so the request logger goes first
  .use(morganMiddleware)
  .use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", environment.CLIENT_ORIGIN);
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    // Browsers send an OPTIONS "preflight" before cross-origin requests
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  })
  .use(express.json())
  .use(auth(config))
  .use("/api", Authroutes)
  .use("/api/media", MediaRoutes)
  .use("/api/users", UserRoutes)
  .use("/api/posts", PostRoutes)
  .use("/api/story", StoryRoutes)
  .use("/api/chat", ChatRoutes)
  .use("/api/messages", MessageRoutes);

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.all("/{*splat}", (req: Request, res: Response) => {
  res.status(404).json({ message: "Page Not Found 😔" });
  Logger.http(`${req.method} - ${req.url} - ${req.ip} Page Not Found 🔦🔦`);
});

// Error handlers must be registered last
app.use(ErrorHandler);

new SocketManager(io);

const start = async () => {
  // Connect to the database before accepting requests
  await DB_Connection();
  storycheck();
  logcheck();
  httpServer.listen(environment.PORT, () => {
    Logger.debug(`🚀🚀🚀Server is running on port ${environment.PORT}`);
  });
};

start().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
