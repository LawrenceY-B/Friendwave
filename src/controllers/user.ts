import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import User, { USERNAME_COLLATION } from "../models/user.model";
import Following from "../models/following.model";
import Post from "../models/post.model";
import SavedPost from "../models/savedpost.model";
import { storage } from "../lib/s3";
import { escapeRegex } from "../lib/validation";
import { toProfile, toSuggestion, toUserSummary, USER_SUMMARY_FIELDS } from "../lib/dto";
import { badRequest, conflict, notFound, pageFrom, paginate, send, sendPage } from "../lib/http";
import { buildPosts, POST_AUTHOR } from "../services/post.service";
import Logger from "../lib/logger";
import { notify, unnotify } from "../services/notification.service";
import { applyDeletion, planDeletion } from "../services/user-deletion";
import { canDeleteAuth0Users, deleteAuth0User } from "../lib/auth0";

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
  // Whether you follow each result, in one query for the whole page
  const me = req.user.userID;
  const followed = new Set(
    (await Following.find({ userID: me, followingID: { $in: items.map((u) => u._id) } }).lean()).map((f) =>
      String(f.followingID)
    )
  );
  const results = items.map((user) => ({
    ...toUserSummary(user)!,
    isMe: String(user._id) === me,
    isFollowing: followed.has(String(user._id)),
  }));
  sendPage(res, results, nextCursor);
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
  let isNew = false;
  try {
    const result = await Following.updateOne({ userID: me, followingID: target }, {}, { upsert: true });
    isNew = result.upsertedCount === 1;
  } catch (error: any) {
    // Two follow requests at once: the unique index stops the second, which is fine
    if (error.code !== 11000) throw error;
  }
  send(res, { following: true, followerCount: await Following.countDocuments({ followingID: target }) });
  if (isNew) notify({ recipient: target, actor: me, type: "follow" });
};

// DELETE /users/:id/follow
export const unfollow = async (req: Request, res: Response) => {
  const target = String(req.params.id);
  const result = await Following.deleteOne({ userID: req.user.userID, followingID: target });
  send(res, { following: false, followerCount: await Following.countDocuments({ followingID: target }) });
  if (result.deletedCount === 1) unnotify({ recipient: target, actor: req.user.userID, type: "follow" });
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

// GET /users/suggestions. "People your friends follow": accounts followed by people
// you follow, ranked by how many of them follow it. If that's not enough (e.g. you
// follow nobody yet), filled up with the most-followed accounts, then the newest.
export const getSuggestions = async (req: Request, res: Response) => {
  const me = new Types.ObjectId(req.user.userID);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
  const following: Types.ObjectId[] = await Following.find({ userID: me }).distinct("followingID");
  const exclude = [me, ...following];

  const mutual = following.length
    ? await Following.aggregate<{ _id: Types.ObjectId; mutualCount: number; via: Types.ObjectId[] }>([
        { $match: { userID: { $in: following }, followingID: { $nin: exclude } } },
        { $group: { _id: "$followingID", mutualCount: { $sum: 1 }, via: { $push: "$userID" } } },
        { $sort: { mutualCount: -1, _id: -1 } },
        { $limit: limit },
      ])
    : [];

  const picked = mutual.map((m) => m._id);
  let fill: Types.ObjectId[] = [];
  if (picked.length < limit) {
    const popular = await Following.aggregate<{ _id: Types.ObjectId }>([
      { $match: { followingID: { $nin: [...exclude, ...picked] } } },
      { $group: { _id: "$followingID", followers: { $sum: 1 } } },
      { $sort: { followers: -1, _id: -1 } },
      { $limit: limit - picked.length },
    ]);
    fill = popular.map((p) => p._id);
  }
  if (picked.length + fill.length < limit) {
    const newest = await User.find({ _id: { $nin: [...exclude, ...picked, ...fill] } })
      .sort({ _id: -1 })
      .limit(limit - picked.length - fill.length)
      .select("_id")
      .lean();
    fill = [...fill, ...newest.map((u) => u._id as Types.ObjectId)];
  }

  const viaIds = mutual.flatMap((m) => m.via.slice(0, 2));
  const users = await User.find({ _id: { $in: [...picked, ...fill, ...viaIds] } }).select(USER_SUMMARY_FIELDS).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const results = [
    ...mutual.map((m) => ({ user: byId.get(String(m._id)), mutualCount: m.mutualCount, via: m.via })),
    ...fill.map((id) => ({ user: byId.get(String(id)), mutualCount: 0, via: [] as Types.ObjectId[] })),
  ]
    .filter((r) => r.user)
    .map((r) =>
      toSuggestion(
        r.user!,
        r.mutualCount,
        r.via.slice(0, 2).map((id) => byId.get(String(id))?.Username).filter(Boolean) as string[]
      )
    );
  send(res, results);
};

// DELETE /users/me  { confirm: "<your username>" }. Deletes your account and everything of
// yours: posts (and what's on them), comments, replies, likes, follows, saves, stories,
// chats and notifications, plus your photos on S3. If the API has Auth0 Management
// credentials, your Auth0 login is deleted too; otherwise a new, empty profile would be
// created if you logged in again with it.
export const deleteMe = async (req: Request, res: Response) => {
  const me = await User.findById(req.user.userID).select("Username").lean();
  if (!me) throw notFound("User");
  if (String(req.body.confirm).toLowerCase() !== me.Username.toLowerCase())
    throw badRequest("Type your username exactly to confirm");

  const db = mongoose.connection.db!;
  const plan = await planDeletion(db, { userIds: [req.user.userID] });
  await applyDeletion(db, plan);
  // Photos: after the data, so a failure here never leaves a broken account behind
  for (let i = 0; i < plan.mediaKeys.length; i += 1000)
    await storage.deleteImages(plan.mediaKeys.slice(i, i + 1000)).catch((error) => Logger.error(error));

  let auth0Deleted = false;
  if (canDeleteAuth0Users()) {
    try {
      await deleteAuth0User(req.user.Auth0id);
      auth0Deleted = true;
    } catch (error) {
      Logger.error(error); // your data is gone either way; the login can be removed by hand
    }
  }
  send(res, { deleted: true, auth0Deleted });
};
