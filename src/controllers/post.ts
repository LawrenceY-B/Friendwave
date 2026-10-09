import { Request, Response } from "express";
import Post from "../models/post.model";
import Following from "../models/following.model";
import SavedPost from "../models/savedpost.model";
import Comment from "../models/comment.model";
import Stories from "../models/stories.model";
import { storage } from "../lib/s3";
import { badRequest, notFound, pageFrom, paginate, send, sendPage } from "../lib/http";
import { buildPosts, POST_AUTHOR } from "../services/post.service";
import Logger from "../lib/logger";

const findPost = async (postId: string) => {
  const post = await Post.findById(postId).populate(POST_AUTHOR).lean();
  if (!post) throw notFound("Post");
  return post;
};

const ensurePostExists = async (postId: string) => {
  if (!(await Post.exists({ _id: postId }))) throw notFound("Post");
};

// GET /feed. Your posts and the posts of people you follow, newest first.
export const getFeed = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const following = await Following.find({ userID: me }).distinct("followingID");
  const { items, nextCursor } = await paginate(
    (filter) => Post.find(filter).populate(POST_AUTHOR).lean(),
    { userId: { $in: [me, ...following] } },
    pageFrom(req)
  );
  sendPage(res, await buildPosts(items, me), nextCursor);
};

// POST /posts  (multipart: images[] (1-10), caption)
export const createPost = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const images = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (images.length === 0) throw badRequest("At least one image is required");

  // Upload all images; if any fails, remove the ones that succeeded
  const uploads = await Promise.allSettled(images.map((image) => storage.uploadImage(image, "posts", me)));
  const keys = uploads.flatMap((u) => (u.status === "fulfilled" ? [u.value] : []));
  const failed = uploads.find((u) => u.status === "rejected");
  if (failed) {
    await storage.deleteImages(keys);
    throw (failed as PromiseRejectedResult).reason;
  }

  const post = await Post.create({ userId: me, imageUrl: keys, caption: req.body.caption ?? "" });
  const [created] = await buildPosts([await findPost(String(post._id))], me);
  send(res, created, 201);
};

// GET /posts/:id
export const getPost = async (req: Request, res: Response) => {
  const [post] = await buildPosts([await findPost(String(req.params.id))], req.user.userID);
  send(res, post);
};

// DELETE /posts/:id. Owner only; also removes its comments, saves, stories and images.
export const deletePost = async (req: Request, res: Response) => {
  const postId = String(req.params.id);
  // Matching on userId too means only the owner can delete; for anyone else it's "not found"
  const deleted = await Post.findOneAndDelete({ _id: postId, userId: req.user.userID }).lean();
  if (!deleted) throw notFound("Post");
  await Promise.all([
    Comment.deleteMany({ postId }),
    SavedPost.deleteMany({ postId }),
    Stories.deleteMany({ postId }),
  ]);
  storage.deleteImages(deleted.imageUrl).catch((err) => Logger.error(err));
  send(res, null);
};

// POST /posts/:id/like and DELETE /posts/:id/like. Idempotent, atomic.
export const like = async (req: Request, res: Response) => {
  const post = await Post.findByIdAndUpdate(
    String(req.params.id),
    { $addToSet: { likes: req.user.userID } },
    { returnDocument: "after" }
  ).lean();
  if (!post) throw notFound("Post");
  send(res, { liked: true, likeCount: post.likes.length });
};

export const unlike = async (req: Request, res: Response) => {
  const post = await Post.findByIdAndUpdate(
    String(req.params.id),
    { $pull: { likes: req.user.userID } },
    { returnDocument: "after" }
  ).lean();
  if (!post) throw notFound("Post");
  send(res, { liked: false, likeCount: post.likes.length });
};

// POST /posts/:id/save and DELETE /posts/:id/save
export const save = async (req: Request, res: Response) => {
  const postId = String(req.params.id);
  await ensurePostExists(postId);
  try {
    await SavedPost.updateOne({ userId: req.user.userID, postId }, {}, { upsert: true });
  } catch (error: any) {
    if (error.code !== 11000) throw error; // saved twice at the same moment: fine
  }
  send(res, { saved: true });
};

export const unsave = async (req: Request, res: Response) => {
  await SavedPost.deleteOne({ userId: req.user.userID, postId: String(req.params.id) });
  send(res, { saved: false });
};
