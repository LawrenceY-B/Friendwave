import { Types } from "mongoose";
import Notification, { NotificationType } from "../models/notification.model";
import User from "../models/user.model";
import Post from "../models/post.model";
import { toNotification, USER_SUMMARY_FIELDS } from "../lib/dto";
import { emitToUsers } from "../lib/realtime";
import Logger from "../lib/logger";

type Id = string | Types.ObjectId;

interface NotifyInput {
  recipient: Id;
  actor: Id;
  type: NotificationType;
  postId?: Id;
}

// Turns notification documents into API objects, loading actors and posts in 2 queries
export const buildNotifications = async (notifications: Record<string, any>[]) => {
  const userIds = [...new Set(notifications.map((n) => String(n.actorId)))];
  const postIds = [...new Set(notifications.filter((n) => n.postId).map((n) => String(n.postId)))];
  const [users, posts] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select(USER_SUMMARY_FIELDS).lean(),
    Post.find({ _id: { $in: postIds } }).select("imageUrl").lean(),
  ]);
  const usersById = new Map(users.map((u) => [String(u._id), u as Record<string, any>]));
  const postsById = new Map(posts.map((p) => [String(p._id), p as Record<string, any>]));
  return notifications.map((n) => toNotification(n, usersById, postsById));
};

// Records a notification and pushes it live. Never for your own actions.
// Fire-and-forget: a failure here must never break the action that caused it.
export const notify = ({ recipient, actor, type, postId }: NotifyInput) => {
  if (String(recipient) === String(actor)) return;
  (async () => {
    try {
      const created = await Notification.create({ userId: recipient, actorId: actor, type, postId });
      const [dto] = await buildNotifications([created.toObject()]);
      emitToUsers([recipient], "notification:new", dto);
    } catch (error: any) {
      if (error.code !== 11000) Logger.error(error); // 11000: already notified (like/follow)
    }
  })();
};

// Undo a like/follow notification (unlike, unfollow)
export const unnotify = ({ recipient, actor, type, postId }: NotifyInput) => {
  Notification.deleteOne({ userId: recipient, actorId: actor, type, ...(postId ? { postId } : {}) }).catch((error) =>
    Logger.error(error)
  );
};
