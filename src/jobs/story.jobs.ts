import cron from "node-cron";
import { NextFunction, Request, Response } from "express";
import { validateStory } from "../services/story.service";
import User from "../models/user.model";
import Stories from "../models/stories.model";
import Logger from "../lib/logger";
import fs from "fs";
import path from "path";

export const storycheck = async () => {
  try {
    let task = cron.schedule("30 */1 * * *", async () => {
      Logger.info("task started");
      const users = await User.find();
      const singleuser = users.map((user) => {
        const stories = user.Stories.map(async (story) => {
          const check = await Stories.findOne({ _id: story });
          if (!check) {
            const updatePost = await User.findOneAndUpdate(
              { UserID: user.UserID },
              { $pull: { Stories: story } },
              { new: true }
            );
            Logger.info(updatePost);
            if (updatePost) {
              //   task.stop();
              Logger.info("removed story");
            }
          }
        });
      });
    });
  } catch (error: any) {
    Logger.error(error);
  }
};

export const logcheck = () => {
  try {
    const filePath = path.join(__dirname, "../../logs/error.log");
    let task = cron.schedule("* */24 * * *", async () => {
      Logger.info("task started");
     fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          Logger.error(`File ${filePath} does not exist`);
          return;
        }
        fs.writeFile(filePath, "", (err) => {
          if (err) {
            Logger.error(`Error deleting contents of ${filePath}:`, err);
            return;
          }
          Logger.info(`Successfully deleted contents of logs`);
        });
      });
    });
  } catch (error: any) {
    Logger.error(error);
  }
};
