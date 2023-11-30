import cron from "node-cron";
import { NextFunction, Request, Response } from "express";
import { validateStory } from "../services/story.service";
import User from "../models/user.model";
import Stories from "../models/stories.model";

export const storycheck = async () => {
  try {
    let task = cron.schedule("30 */1 * * *", async () => {
        console.log("task started");
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
            console.log(updatePost);
            if (updatePost) {
            //   task.stop();
              console.log("removed story");
            }
          }
        });
      });
    });
  } catch (error:any) {
    console.log(error);
    throw new Error(error);
  }
};
