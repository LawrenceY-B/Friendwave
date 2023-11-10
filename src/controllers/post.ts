import Post from "../models/post.model";
import { NextFunction, Request, Response } from "express";

import { ImageUpload, validatePost } from "../services/post.service";
import User from "../models/user.model";

export const newPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user.userID;
    const { error } = validatePost(req.body);
    const { caption } = req.body;

    const images = req.files as Express.Multer.File[];
    const imageUrls = await ImageUpload(images, next, userId);

    const post = new Post({
      userId: userId,
      imageUrl: imageUrls,
      caption: caption,
      likes: [],
      comments: [],
      dateTime: Date.now(),
    });

    await post.save();

    const updatedPost = await Post.findOneAndUpdate(
        { _id: post._id },
        { $set: { postId: post._id } },
        { new: true }
      );
    console.log(updatedPost);
    const updateUser = await User.findById(userId);
    updateUser?.Posts.push(updatedPost?.postId);
    updateUser?.save();

    return res
      .status(200)
      .json({ success: true, message: "Post created successfully", post });
  } catch (error) {
    next(error);
  }
};
