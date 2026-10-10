import { Request, Response } from "express";
import Post from "../models/post.model";
import Following from "../models/following.model";
import SavedPost from "../models/savedpost.model";
import Comment from "../models/comment.model";
import Stories from "../models/stories.model";
import { storage } from "../lib/s3";
import { badRequest, notFound, pageFrom, paginate, send, sendPage } from "../lib/http";
import { broadcastCounts, buildPosts, POST_AUTHOR } from "../services/post.service";
import { notify, unnotify } from "../services/notification.service";
import Notification from "../models/notification.model";
import { emitToUsers } from "../lib/realtime";
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

  // Tell followers' open feeds there's something new ("New posts" pill)
  Following.find({ followingID: me })
    .distinct("userID")
    .then((followers) => emitToUsers(followers, "feed:new-post", { postId: String(post._id), authorId: me }))
    .catch((err) => Logger.error(err));
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
    Notification.deleteMany({ postId }),
  ]);
  storage.deleteImages(deleted.imageUrl).catch((err) => Logger.error(err));
  send(res, null);
};

// POST /posts/:id/like and DELETE /posts/:id/like. Idempotent, atomic.
// Only an actual change notifies the author and updates live counts, so
// liking twice (double tap + button) doesn't notify twice.
const setLike = async (req: Request, res: Response, liked: boolean) => {
  const postId = String(req.params.id);
  const me = req.user.userID;
  const result = await Post.updateOne(
    { _id: postId },
    liked ? { $addToSet: { likes: me } } : { $pull: { likes: me } }
  );
  if (result.matchedCount === 0) throw notFound("Post");
  const post = await Post.findById(postId).select("likes userId").lean();
  send(res, { liked, likeCount: post?.likes.length ?? 0 });

  if (result.modifiedCount === 1 && post) {
    broadcastCounts(postId);
    const change = { recipient: post.userId, actor: me, type: "like" as const, postId };
    if (liked) notify(change);
    else unnotify(change);
  }
};

export const like = (req: Request, res: Response) => setLike(req, res, true);
export const unlike = (req: Request, res: Response) => setLike(req, res, false);

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
