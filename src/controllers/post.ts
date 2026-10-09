import Post from "../models/post.model";
import { NextFunction, Request, Response } from "express";
import {
  validateComment,
  validateCommentID,
  validateDeleteReply,
  validatePost,
  validatePostID,
  validateReply,
} from "../services/post.service";
import User from "../models/user.model";
import SavedPost from "../models/savedpost.model";
import Stories from "../models/stories.model";
import { randomUUID } from "crypto";
import Comment from "../models/comment.model";
import { IReplies } from "../interfaces/post.interface";
import Logger from "../lib/logger";
import { deleteImages, uploadImage } from "../lib/s3";
import { objectId } from "../lib/validation";

export const newPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user.userID;
    const { error } = validatePost(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const { caption } = req.body;

    const images = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (images.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one image is required" });
    }

    // Upload all images; if any fails, remove the ones that succeeded
    const uploads = await Promise.allSettled(
      images.map((image) => uploadImage(image, "posts", userId))
    );
    const keys = uploads.flatMap((u) => (u.status === "fulfilled" ? [u.value] : []));
    const failed = uploads.find((u) => u.status === "rejected");
    if (failed) {
      await deleteImages(keys);
      throw (failed as PromiseRejectedResult).reason;
    }

    const post = new Post({
      userId: userId,
      imageUrl: keys,
      caption: caption,
      likes: [],
      comments: [],
      dateTime: Date.now(),
    });
    // The _id exists before saving, so postId can be set in the same write
    post.postId = post._id;
    await post.save();

    await User.updateOne({ _id: userId }, { $push: { Posts: post._id } });

    return res
      .status(200)
      .json({ success: true, message: "Post created successfully", post });
  } catch (error) {
    next(error);
  }
};

export const getPost = async(req:Request, res:Response, next:NextFunction)=>{
try {
  const { error } = objectId().validate(req.params.postId);
  if (error) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }
  const post = await Post.findOne({postId:req.params.postId})
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
      return res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    // Matching on userId too means only the owner can delete the post
    const deleted = await Post.findOneAndDelete({ postId: postID, userId: userId });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // Clean up everything that pointed at this post
    await User.updateOne({ _id: userId }, { $pull: { Posts: deleted._id } });
    await Comment.deleteMany({ postId: postID });

    const saved = await SavedPost.find({ postId: postID });
    if (saved.length > 0) {
      await SavedPost.deleteMany({ postId: postID });
      await User.updateMany(
        {},
        { $pull: { SavedPosts: { $in: saved.map((s) => s._id.toString()) } } }
      );
    }

    const stories = await Stories.find({ postId: postID });
    if (stories.length > 0) {
      await Stories.deleteMany({ postId: postID });
      await User.updateMany({}, { $pull: { Stories: { $in: stories.map((s) => s._id) } } });
    }

    // Raw stored keys (without the getter that turns them into URLs)
    const keys: string[] = deleted.get("imageUrl", null, { getters: false });
    deleteImages(keys).catch((err) => Logger.error(err));

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
      return res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    // One atomic update: MongoDB adds the id only if it isn't there yet.
    // (Reading, changing in JS, then saving can lose likes when two arrive at once.)
    const result = await Post.updateOne(
      { postId: postID },
      { $addToSet: { likes: userID } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "You have already liked this post",
      });
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
      return res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    const result = await Post.updateOne(
      { postId: postID },
      { $pull: { likes: userID } }
    );
    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }
    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "You have not liked this post",
      });
    }

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
      return res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;

    if (!(await Post.exists({ postId: postID }))) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const isSaved = await SavedPost.findOne({ postId: postID, userId: userID });
    if (isSaved) {
      // Every code path must send a response, or the request hangs
      return res
        .status(400)
        .json({ success: false, message: "Post already saved" });
    }

    const savedPost = await SavedPost.create({ postId: postID, userId: userID });
    await User.updateOne(
      { _id: userID },
      { $addToSet: { SavedPosts: savedPost._id.toString() } }
    );

    res
      .status(200)
      .json({ success: true, message: "Post saved successfully" });
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
      return res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;

    const removeSaved = await SavedPost.findOneAndDelete({
      userId: userID,
      postId: postID,
    });
    if (!removeSaved) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    await User.updateOne(
      { _id: userID },
      { $pull: { SavedPosts: removeSaved._id.toString() } }
    );
    return res.status(200).json({
      status: true,
      message: "Post removed from saved",
    });
  } catch (error) {
    next(error);
  }
};

export const createComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user.userID;
    const { error } = validateComment(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const { postID, message } = req.body;
    const isExisting = await Post.exists({ postId: postID });
    if (!isExisting) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const newComment = await Comment.create({
      userId: user,
      postId: postID,
      comment: message,
      dateTime: Date.now(),
    });
    await Post.updateOne(
      { postId: postID },
      { $push: { comments: newComment._id } }
    );
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
    const { error } = validatePostID(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const { postID } = req.body;
    const isExisting = await Post.exists({ postId: postID });
    if (!isExisting) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }
    const comments = await Comment.find({ postId: postID })
      .select("-postId")
      .populate({ path: "userId", select: "Username ProfileUrl" })
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
    const userID = req.user.userID;
    const { commentId } = req.body;
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    // Only the comment's author or the post's owner may delete it
    const post = await Post.findOne({ postId: comment.postId });
    const isAllowed = comment.userId.equals(userID) || post?.userId.equals(userID);
    if (!isAllowed) {
      return res
        .status(403)
        .json({ success: false, message: "You can't delete this comment" });
    }

    await comment.deleteOne();
    await Post.updateOne({ postId: comment.postId }, { $pull: { comments: comment._id } });
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
    const { error } = validateReply(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const { commentID, message } = req.body;
    const user = req.user.userID;
    const comment = await Comment.findById(commentID);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    const newReply: IReplies = {
      replyId: randomUUID(),
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
    const { error } = validateDeleteReply(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const user = req.user.userID;
    const { commentID, replyID } = req.body;

    const comment = await Comment.findById(commentID);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    const reply = comment.replies.find(
      (reply: IReplies) => reply.replyId === replyID
    );
    if (!reply) {
      return res
        .status(404)
        .json({ success: false, message: "Reply not found" });
    }
    // Only the reply's author or the comment's author may delete it
    if (String(reply.userId) !== user && !comment.userId.equals(user)) {
      return res
        .status(403)
        .json({ success: false, message: "You can't delete this reply" });
    }
    comment.replies = comment.replies.filter(
      (reply: IReplies) => reply.replyId !== replyID
    );
    await comment.save();
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
