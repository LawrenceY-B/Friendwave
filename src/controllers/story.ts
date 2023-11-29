import Post from "../models/post.model";
import Stories from "../models/stories.model";
import User from "../models/user.model";
import { v4 as uiv4 } from "uuid";
import { NextFunction, Request, Response } from "express";
import { validateStory } from "../services/story.service";

export const addtoStory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userID = req.user.userID;
    const { error } = validateStory(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    const { postID } = req.body;
    console.log(postID)
    const story = new Stories({
      userId: userID,
      postId: postID,
      storyId: uiv4(),
    });
    const result = await story.save();
    const data = await result.populate({
      path: "postId",
      populate: {
        path: "userId",
        select: "Username ProfileUrl postId",
      },
    });
    console.log(data)


    const updatedPost = await User.findOneAndUpdate(
      { UserID: userID },
      { $push: { Stories: result._id } },
      { new: true }
    );
    if (!updatedPost) {
      return res
        .status(404)
        .json({ success: false, message: "Something went wrong" });
    } else {
      res
        .status(200)
        .json({ success: true, message: "Story added successfully", data:data});
    }
  } catch (error) {
    next(error);
  }
};
