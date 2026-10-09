import mongoose from "mongoose";
import { environment } from "./environments/endpoints.config";
import { DB_Connection } from "./database/db";
import { createAppServer } from "./app";
import { startLogCleanup } from "./jobs/maintenance.jobs";
import Logger from "./lib/logger";

const start = async () => {
  // Connect to the database before accepting requests
  await DB_Connection();
  const { httpServer, io } = createAppServer();
  const jobs = [startLogCleanup()];

  httpServer.listen(environment.PORT, () => {
    Logger.debug(`🚀🚀🚀Server is running on port ${environment.PORT}`);
  });

  // Graceful shutdown: Render sends SIGTERM before replacing the server on a
  // deploy. Stop taking new connections, let running requests finish, close
  // the database, then exit. Force-exit if that takes more than 10 seconds.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    Logger.info(`${signal} received, shutting down`);
    setTimeout(() => process.exit(1), 10_000).unref();
    jobs.forEach((job) => job.stop());
    // io.close() also closes the HTTP server
    io.close(async () => {
      await mongoose.disconnect();
      Logger.info("Shutdown complete");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
