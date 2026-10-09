import cron from "node-cron";
import User from "../models/user.model";
import Stories from "../models/stories.model";
import Logger from "../lib/logger";
import fs from "fs/promises";
import path from "path";

// MongoDB's TTL index deletes expired stories, but the ids stay in each
// user's Stories array. Every hour, pull ids that no longer exist.
export const storycheck = () => {
  cron.schedule("30 * * * *", async () => {
    // The try/catch must be INSIDE the callback: the callback runs later,
    // long after a try/catch around cron.schedule() has finished.
    try {
      const liveStoryIds = await Stories.distinct("_id");
      const result = await User.updateMany(
        { Stories: { $elemMatch: { $nin: liveStoryIds } } },
        { $pull: { Stories: { $nin: liveStoryIds } } }
      );
      Logger.info(`Story cleanup: updated ${result.modifiedCount} users`);
    } catch (error) {
      Logger.error(error);
    }
  });
};

// Empty the error log once a day, at midnight
export const logcheck = () => {
  const filePath = path.join(__dirname, "../../logs/error.log");
  cron.schedule("0 0 * * *", async () => {
    try {
      await fs.writeFile(filePath, "");
      Logger.info(`Successfully deleted contents of logs`);
    } catch (error) {
      Logger.error(error);
    }
  });
};
