import { Request, Response } from "express";
import User, { USERNAME_COLLATION } from "../models/user.model";
import Following from "../models/following.model";
import Post from "../models/post.model";
import SavedPost from "../models/savedpost.model";
import { storage } from "../lib/s3";
import { escapeRegex } from "../lib/validation";
import { toProfile, toUserSummary, USER_SUMMARY_FIELDS } from "../lib/dto";
import { badRequest, conflict, notFound, pageFrom, paginate, send, sendPage } from "../lib/http";
import { buildPosts, POST_AUTHOR } from "../services/post.service";
import Logger from "../lib/logger";

// Counts come straight from the collections, so they can never drift out of sync
const loadProfile = async (userId: string, viewerId: string) => {
  const user = await User.findById(userId).lean();
  if (!user) throw notFound("User");
  const isMe = userId === viewerId;
  const [followerCount, followingCount, postCount, follows] = await Promise.all([
    Following.countDocuments({ followingID: userId }),
    Following.countDocuments({ userID: userId }),
    Post.countDocuments({ userId }),
    isMe ? null : Following.exists({ userID: viewerId, followingID: userId }),
  ]);
  return toProfile(user, { followerCount, followingCount, postCount, isMe, isFollowing: !!follows });
};

const ensureUserExists = async (userId: string) => {
  if (!(await User.exists({ _id: userId }))) throw notFound("User");
};

// GET /users/me
export const getMe = async (req: Request, res: Response) => {
  send(res, await loadProfile(req.user.userID, req.user.userID));
};

// PATCH /users/me  (multipart: name, username, bio, avatar)
export const updateMe = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const { name, username, bio } = req.body;
  if (username !== undefined) {
    // Excluding yourself lets you change the capitalisation of your own username
    const taken = await User.exists({ Username: username, _id: { $ne: me } }).collation(USERNAME_COLLATION);
    if (taken) throw conflict("Username already taken");
  }

  // Only change the fields that were actually sent
  const update: Record<string, string> = {};
  if (name !== undefined) update.Name = name;
  if (username !== undefined) update.Username = username;
  if (bio !== undefined) update.Bio = bio;
  if (req.file) update.ProfileUrl = await storage.uploadImage(req.file, "profile", me);

  // Returns the document as it was BEFORE the update
  const before = await User.findByIdAndUpdate(me, update).lean();
  if (!before) throw notFound("User");
  if (req.file && before.ProfileUrl) {
    // Remove the old picture from S3 (skipped automatically for Auth0 URLs)
    storage.deleteImages([before.ProfileUrl]).catch((err) => Logger.error(err));
  }
  send(res, await loadProfile(me, me));
};

// GET /users?search=
export const searchUsers = async (req: Request, res: Response) => {
  // Escape the input so characters like ".*(" are matched literally
  const text = new RegExp(escapeRegex(String(req.query.search)), "i");
  const { items, nextCursor } = await paginate(
    (filter) => User.find(filter).select(USER_SUMMARY_FIELDS).lean(),
    { $or: [{ Username: text }, { Name: text }] },
    pageFrom(req)
  );
  sendPage(res, items.map(toUserSummary), nextCursor);
};

// GET /users/:id
export const getUser = async (req: Request, res: Response) => {
  send(res, await loadProfile(String(req.params.id), req.user.userID));
};

// GET /users/:id/posts
export const getUserPosts = async (req: Request, res: Response) => {
  const userId = String(req.params.id);
  await ensureUserExists(userId);
  const { items, nextCursor } = await paginate(
    (filter) => Post.find(filter).populate(POST_AUTHOR).lean(),
    { userId },
    pageFrom(req)
  );
  sendPage(res, await buildPosts(items, req.user.userID), nextCursor);
};

// GET /users/:id/followers
export const getFollowers = async (req: Request, res: Response) => {
  const userId = String(req.params.id);
  await ensureUserExists(userId);
  const { items, nextCursor } = await paginate(
    (filter) => Following.find(filter).populate({ path: "userID", select: USER_SUMMARY_FIELDS }).lean(),
    { followingID: userId },
    pageFrom(req)
  );
  sendPage(res, items.map((f) => toUserSummary(f.userID as any)).filter(Boolean), nextCursor);
};

// GET /users/:id/following
export const getFollowing = async (req: Request, res: Response) => {
  const userId = String(req.params.id);
  await ensureUserExists(userId);
  const { items, nextCursor } = await paginate(
    (filter) => Following.find(filter).populate({ path: "followingID", select: USER_SUMMARY_FIELDS }).lean(),
    { userID: userId },
    pageFrom(req)
  );
  sendPage(res, items.map((f) => toUserSummary(f.followingID as any)).filter(Boolean), nextCursor);
};

// POST /users/:id/follow. Idempotent: following someone twice is fine.
export const follow = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const target = String(req.params.id);
  if (target === me) throw badRequest("You can't follow yourself");
  await ensureUserExists(target);
  try {
    await Following.updateOne({ userID: me, followingID: target }, {}, { upsert: true });
  } catch (error: any) {
    // Two follow requests at once: the unique index stops the second, which is fine
    if (error.code !== 11000) throw error;
  }
  send(res, { following: true, followerCount: await Following.countDocuments({ followingID: target }) });
};

// DELETE /users/:id/follow
export const unfollow = async (req: Request, res: Response) => {
  const target = String(req.params.id);
  await Following.deleteOne({ userID: req.user.userID, followingID: target });
  send(res, { following: false, followerCount: await Following.countDocuments({ followingID: target }) });
};

// DELETE /users/me/followers/:id. Stop someone from following you.
export const removeFollower = async (req: Request, res: Response) => {
  const result = await Following.deleteOne({ userID: String(req.params.id), followingID: req.user.userID });
  send(res, { removed: result.deletedCount === 1 });
};

// GET /users/me/saved
export const getSavedPosts = async (req: Request, res: Response) => {
  const { items, nextCursor } = await paginate(
    (filter) => SavedPost.find(filter).populate({ path: "postId", populate: POST_AUTHOR }).lean(),
    { userId: req.user.userID },
    pageFrom(req)
  );
  // A saved post may have been deleted since
  const posts = items.map((saved) => saved.postId as any).filter(Boolean);
  sendPage(res, await buildPosts(posts, req.user.userID), nextCursor);
};
