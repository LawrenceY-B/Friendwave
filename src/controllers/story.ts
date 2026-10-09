import Post from "../models/post.model";
import Stories from "../models/stories.model";
import User from "../models/user.model";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { validateStory, validateStoryID } from "../services/story.service";

const storyPopulate = {
  path: "postId",
  populate: {
    path: "userId",
    select: "Username ProfileUrl postId",
  },
};

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
    if (!(await Post.exists({ postId: postID }))) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const story = await Stories.create({
      userId: userID,
      postId: postID,
      storyId: randomUUID(),
    });
    const data = await story.populate(storyPopulate);

    await User.updateOne({ _id: userID }, { $push: { Stories: story._id } });

    res.status(200).json({
      success: true,
      message: "Story added successfully",
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateStoryID(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    const user = req.user.userID;
    const { storyId } = req.body;

    const deleted = await Stories.findOneAndDelete({
      _id: storyId,
      userId: user,
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Story not found" });
    }

    await User.updateOne({ _id: user }, { $pull: { Stories: deleted._id } });
    res
      .status(200)
      .json({ success: true, message: "Story deleted successfully" });
  } catch (error) {
    next(error)
  }
};
export const getStory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user.userID;
        const story = await Stories.find({userId: user}).populate(storyPopulate)
        if (story.length === 0) {
            return res.status(404).json({success: false, message: "Story not found"})
        }
        res.status(200).json({success: true, message: "Story found", data: story})

    } catch (error) {
       next(error)
    }
}
