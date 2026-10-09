import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import Logger from "../lib/logger";

// Empty the error log once a day, at midnight. Returns the task so the
// server can stop it on shutdown.
export const startLogCleanup = () => {
  const filePath = path.join(__dirname, "../../logs/error.log");
  return cron.schedule("0 0 * * *", async () => {
    // The try/catch must be INSIDE the callback: it runs long after schedule() returns
    try {
      await fs.writeFile(filePath, "");
      Logger.info("Cleared logs/error.log");
    } catch (error) {
      Logger.error(error);
    }
  });
};
