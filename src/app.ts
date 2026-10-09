import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { environment } from "./environments/endpoints.config";
import ErrorHandler from "./middleware/errorhandler";
import morganMiddleware from "./middleware/debughandler";
import { verifyToken } from "./middleware/isAuthorized";
import ApiRoutes from "./routes";
import MediaRoutes from "./routes/media.routes";
import SocketManager from "./controllers/socket";
import { setRealtimeServer } from "./lib/realtime";
import { openapi } from "./docs/openapi";

// Builds the Express app, HTTP server and socket.io server without starting
// them, so tests can create the whole app in-process.
export const createAppServer = () => {
  const app = express();
  // Render (and most hosts) put a proxy in front of the app; trust it so
  // req.ip is the real client IP (needed for rate limiting)
  app.set("trust proxy", 1);

  app
    // Middleware runs in the order it is registered, so the request logger goes first
    .use(morganMiddleware)
    // Security headers. Images must be loadable from the frontend's origin.
    .use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))
    .use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Access-Control-Allow-Origin", environment.CLIENT_ORIGIN);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      // Browsers send an OPTIONS "preflight" before cross-origin requests
      if (req.method === "OPTIONS") return res.sendStatus(204);
      next();
    })
    .use(express.json({ limit: "100kb" }));

  // Public routes
  app.get("/health", (req: Request, res: Response) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp });
  });
  app.get("/api/openapi.json", (req: Request, res: Response) => {
    res.json(openapi);
  });
  app.use("/api/media", MediaRoutes);

  // Everything else needs a logged-in user, and is rate limited per IP
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: environment.RATE_LIMIT_PER_MINUTE,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { success: false, message: "Too many requests, slow down" },
    }),
    verifyToken,
    ApiRoutes
  );

  app.all("/{*splat}", (req: Request, res: Response) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // Error handlers must be registered last
  app.use(ErrorHandler);

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: environment.CLIENT_ORIGIN },
  });
  new SocketManager(io);
  setRealtimeServer(io);

  return { app, httpServer, io };
};
