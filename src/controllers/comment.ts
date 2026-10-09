import { Request, Response } from "express";
import { randomUUID } from "crypto";
import Post from "../models/post.model";
import Comment from "../models/comment.model";
import User from "../models/user.model";
import { toComment, toReply, USER_SUMMARY_FIELDS } from "../lib/dto";
import { forbidden, notFound, pageFrom, paginate, send, sendPage } from "../lib/http";
import { IReply } from "../interfaces/post.interface";

// Loads every author (of comments and their replies) in one query
const usersFor = async (comments: Record<string, any>[]) => {
  const ids = new Set<string>();
  for (const comment of comments) {
    ids.add(String(comment.userId));
    for (const reply of comment.replies ?? []) ids.add(String(reply.userId));
  }
  const users = await User.find({ _id: { $in: [...ids] } }).select(USER_SUMMARY_FIELDS).lean();
  return new Map(users.map((user) => [String(user._id), user as Record<string, any>]));
};

// GET /posts/:id/comments. Newest first.
export const getComments = async (req: Request, res: Response) => {
  const postId = String(req.params.id);
  if (!(await Post.exists({ _id: postId }))) throw notFound("Post");
  const { items, nextCursor } = await paginate((filter) => Comment.find(filter).lean(), { postId }, pageFrom(req));
  const users = await usersFor(items);
  sendPage(res, items.map((comment) => toComment(comment, users)), nextCursor);
};

// POST /posts/:id/comments  { text }
export const createComment = async (req: Request, res: Response) => {
  const postId = String(req.params.id);
  if (!(await Post.exists({ _id: postId }))) throw notFound("Post");
  const comment = await Comment.create({ userId: req.user.userID, postId, comment: req.body.text });
  const plain = comment.toObject();
  send(res, toComment(plain, await usersFor([plain])), 201);
};

// DELETE /comments/:id. The comment's author or the post's owner.
export const deleteComment = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const comment = await Comment.findById(String(req.params.id)).lean();
  if (!comment) throw notFound("Comment");
  if (!comment.userId.equals(me)) {
    const post = await Post.findById(comment.postId).select("userId").lean();
    if (!post?.userId.equals(me)) throw forbidden("You can't delete this comment");
  }
  await Comment.deleteOne({ _id: comment._id });
  send(res, null);
};

// POST /comments/:id/replies  { text }
export const createReply = async (req: Request, res: Response) => {
  const reply: IReply = {
    replyId: randomUUID(),
    userId: req.user.userID,
    reply: req.body.text,
    dateTime: new Date(),
  };
  // $push is atomic, so two replies at once can't overwrite each other
  const result = await Comment.updateOne({ _id: String(req.params.id) }, { $push: { replies: reply } });
  if (result.matchedCount === 0) throw notFound("Comment");
  send(res, toReply(reply, await usersFor([{ userId: reply.userId }])), 201);
};

// DELETE /comments/:id/replies/:replyId. The reply's author or the comment's author.
export const deleteReply = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const { replyId } = req.params;
  const comment = await Comment.findById(String(req.params.id)).lean();
  if (!comment) throw notFound("Comment");
  const reply = comment.replies.find((r) => r.replyId === replyId);
  if (!reply) throw notFound("Reply");
  if (String(reply.userId) !== me && !comment.userId.equals(me)) {
    throw forbidden("You can't delete this reply");
  }
  await Comment.updateOne({ _id: comment._id }, { $pull: { replies: { replyId } } });
  send(res, null);
};
