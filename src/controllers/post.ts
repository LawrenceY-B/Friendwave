import Post from "../models/post.model";
import { NextFunction, Request, Response } from "express";

import {
  ImageUpload,
  validatePost,
  validatePostID,
} from "../services/post.service";
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
    // console.log(updatedPost);
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
export const deletePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user.userID;
    const { error } = validatePostID(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    const post = await Post.findById(postID);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    const deletePost = await Post.findOneAndDelete({
      postId: postID,
      userId: userId,
    });
    if (deletePost) {
      const deletedpostID = deletePost.postId;
      const user = await User.findById(userId);

      if (user) {
        user.Posts = user.Posts.filter(
          (postId) => postId.toString() !== deletedpostID.toString()
        );
        await user.save();
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    next(error);
  }
};
export const addLikes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userID = req.user.userID;
    const { PostID } = req.body;

    const isExisting = await Post.findOne({ postId: PostID });
    if (!isExisting) {
      res.status(404).json({ success: false, message: "Post not found" });
    }
    if (isExisting) {
      if (isExisting.likes.includes(userID)) {
        return res.status(400).json({
          success: false,
          message: "You have already liked this post",
        });
      }
      isExisting?.likes.push(userID);
      isExisting?.save();
    }

    res.status(200).json({ success: true, message: `Successfully added` });
  } catch (error) {
    next(error);
  }
};
export const unlike = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userID = req.user.userID;
    const { PostID } = req.body;
    const isExisting = await Post.findOne({ postId: PostID });
    console.log(userID);

    if (!isExisting) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }
    if (!isExisting.likes.includes(userID)) {
      return res.status(400).json({
        success: false,
        message: "You have not liked this post",
      });
    }
    console.log("isExisting.likes:", isExisting.likes);
    console.log("userID:", userID);

    const updatedLikes = isExisting.likes.filter((like) => like != userID);
    console.log("updatedLikes:", updatedLikes);

    console.log(updatedLikes);

    isExisting.likes = updatedLikes;

    await isExisting.save();

    res.status(200).json({ success: true, message: `Successfully unliked` });
  } catch (error) {
    next(error);
  }
};
// if (user){
//     const index = user.Posts.indexOf(postId);
//     user.Posts.splice(index,1);
//     user.save();
// }
