import Post from "../models/post.model";
import { NextFunction, Request, Response } from "express";
import {
  ImageUpload,
  validateComment,
  validateCommentID,
  validatePost,
  validatePostID,
  validateReply,
} from "../services/post.service";
import User from "../models/user.model";
import SavedPost from "../models/savedpost.model";
import { v4 as uui4 } from "uuid";
import { Schema } from "mongoose";
import Comment from "../models/comment.model";
import { IReplies } from "../interfaces/post.interface";
import Logger from "../lib/logger";

export const newPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user.userID;
    const { error } = validatePost(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.message });
    }
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
      saved: false,
    });

    await post.save();

    const updatedPost = await Post.findOneAndUpdate(
      { _id: post._id },
      { $set: { postId: post._id } },
      { new: true }
    );
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
//test this 👇🏽👇🏽👇🏽👇🏽
export const getPost = async(req:Request, res:Response, next:NextFunction)=>{
try {
  const postId = req.params.postId;
  const post = await Post.findOne({postId:postId})
  if(!post){
    return res.status(404).json({success:false, message:"Post not found"})
  }
  res.status(200).json({success:true, message:"Post found", post})
} catch (error) {
  next(error);
}
}
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
    const { error } = validatePostID(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    const isExisting = await Post.findOne({ postId: postID });
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
    const { error } = validatePostID(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    const isExisting = await Post.findOne({ postId: postID });

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

    const updatedLikes = isExisting.likes.filter((like) => like != userID);

    isExisting.likes = updatedLikes;

    await isExisting.save();

    res.status(200).json({ success: true, message: `Successfully unliked` });
  } catch (error) {
    next(error);
  }
};

export const AddtoSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userID = req.user.userID;
    const { error } = validatePostID(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;

    const isSaved = await SavedPost.findOne({ postId: postID, userId: userID });
    if (!isSaved) {
      const savedPost = new SavedPost({
        postId: postID,
        userId: userID,
      });
      await savedPost.save();

      // const filter = { postId: postID, userId: userID };
      // const update = { saved: true };

      // const result = await Post.findByIdAndUpdate(
      //   postID , { $set: { saved:true }}
      // );

      const user = await User.findOne({ UserID: userID });
      if (user) {
        user.SavedPosts.push(savedPost._id);
        await user.save();
      }

      res
        .status(200)
        .json({ success: true, message: "Post saved successfully" });
    }
  } catch (error) {
    next(error);
  }
};

export const RemoveFromSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userID = req.user.userID;
    const { error } = validatePostID(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    const filter = { postId: postID, userId: userID };
    Logger.info(filter);

    const removeSaved = await SavedPost.findOneAndDelete({
      userId: userID,
      postId: postID,
    });
    Logger.info(removeSaved);
    if (!removeSaved) {
      res.status(404).json({ success: false, message: "Post not found" });
    }
    const user = await User.findOne({ UserID: userID });
    if (user) {
      user.SavedPosts = user.SavedPosts.filter(
        (post: any) => post.toString() !== removeSaved?._id.toString()
      );
      await user.save();
    }
    return res.status(200).json({
      status: true,
      message: "Post removed from saved",
    });
  } catch (error) {
    next(error);
  }
};
// work on comments here 👇🏽👇🏽👇🏽👇🏽

export const createComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user.userID;
    const { postID, message } = req.body;
    const { error } = validateComment(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const isExisting = await Post.findOne({ postId: postID });
    if (!isExisting) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const newComment = new Comment({
      userId: user,
      postId: postID,
      comment: message,
      dateTime: Date.now(),
    });
    await newComment.save();

    const updatedPost = await Post.findOneAndUpdate(
      { postId: postID },
      { $push: { comments: newComment._id } },
      { new: true }
    );
    if (!updatedPost) {
      return res
        .status(404)
        .json({ success: false, message: "Something went wrong" });
    }
    res.status(200).json({
      success: true,
      message: "Comment created successfully",
      comment: newComment,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { postID } = req.body;
    const { error } = validatePostID(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const isExisting = await Post.findOne({ postId: postID });
    if (!isExisting) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }
    const comments = await Comment.find({ postId: postID })
      .select("-postId")
      .populate({
        path: "userId",
        options: {
          select: "Username ProfileUrl ",
          sort: { name: -1 },
          strictPopulate: false,
        },
      })
      .sort({ dateTime: -1 });

    res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      comments: comments,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateCommentID(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const { commentId } = req.body;
    const comment = await Comment.findOneAndDelete({ _id: commentId });
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    next(error);
  }
};
export const replyComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { commentID, message } = req.body;
    const { error } = validateReply(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const user = req.user.userID;
    const comment = await Comment.findById(commentID);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    const newReply: IReplies = {
      replyId: uui4(),
      userId: user,
      commentId: commentID,
      reply: message,
      dateTime: Date.now(),
    };

    comment.replies.push(newReply);
    await comment.save();
    res
      .status(200)
      .json({ success: true, message: "Reply added successfully", comment: comment});
  } catch (error) {
    next(error);
  }
};

export const deleteReply = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user.userID;
    const { commentID, replyID } = req.body;

    const comment = await Comment.findById(commentID);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    const reply = comment.replies.find(
      (reply: IReplies) => reply.replyId.toString() === replyID.toString()
    );
    if (!reply) {
      return res
        .status(404)
        .json({ success: false, message: "Reply not found" });
    }
    comment.replies = comment.replies.filter(
      (reply: IReplies) => reply.replyId.toString() !== replyID.toString()
    );
    comment.save();
    res
      .status(200)
      .json({
        success: true,
        message: "Reply deleted successfully",
        reply: comment.replies,
      });
  } catch (error) {
    next(error);
  }
};

/*

1. create IG story array
2. add posts to user stories




*/

// if (user){
//     const index = user.Posts.indexOf(postId);
//     user.Posts.splice(index,1);
//     user.save();
// }
