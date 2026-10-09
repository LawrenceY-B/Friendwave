import joi from "joi";
import { Types } from "mongoose";
import Comment from "../models/comment.model";
import SavedPost from "../models/savedpost.model";
import { toPost, USER_SUMMARY_FIELDS } from "../lib/dto";

export const createPostBody = joi.object({
  caption: joi.string().allow("").max(2200),
});

export const textBody = joi.object({
  text: joi.string().trim().min(1).max(500).required(),
});

export const replyParams = joi.object({
  id: joi.string().hex().length(24).required(),
  replyId: joi.string().uuid().required(),
});

// Populate options that give each post its author's public fields
export const POST_AUTHOR = { path: "userId", select: USER_SUMMARY_FIELDS };

// Turns a page of posts into API objects. Everything the viewer-specific fields
// need (comment counts, "saved by me") is fetched in 2 queries for the whole
// page, rather than 2 queries per post (the "N+1 queries" problem).
export const buildPosts = async (posts: Record<string, any>[], viewerId: string) => {
  const ids = posts.map((post) => post._id as Types.ObjectId);
  const [counts, saved] = await Promise.all([
    Comment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { postId: { $in: ids } } },
      { $group: { _id: "$postId", n: { $sum: 1 } } },
    ]),
    SavedPost.find({ userId: viewerId, postId: { $in: ids } }).lean(),
  ]);
  const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
  const savedIds = new Set(saved.map((s) => String(s.postId)));
  return posts.map((post) =>
    toPost(post, {
      viewerId,
      commentCount: countOf.get(String(post._id)) ?? 0,
      savedByMe: savedIds.has(String(post._id)),
    })
  );
};
