import { Types } from "mongoose";
import { mediaUrl } from "./s3";

// DTOs ("data transfer objects") are the JSON shapes the API sends. Keeping
// them in one place means database details (PascalCase fields, S3 keys, _id)
// never leak to clients, and the database can change without breaking them.
// Inputs are plain objects from .lean() queries.

type Id = Types.ObjectId | string;
type Doc = Record<string, any>;
const id = (value: Id) => String(value);

export const USER_SUMMARY_FIELDS = "Username Name ProfileUrl";

export interface UserSummary {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export const toUserSummary = (user: Doc | null | undefined): UserSummary | null =>
  user
    ? { id: id(user._id), username: user.Username, name: user.Name, avatarUrl: mediaUrl(user.ProfileUrl) }
    : null;

export const toProfile = (
  user: Doc,
  extra: { followerCount: number; followingCount: number; postCount: number; isMe: boolean; isFollowing: boolean }
) => ({
  ...toUserSummary(user)!,
  bio: user.Bio ?? "",
  ...extra,
  // Only you see your own email
  ...(extra.isMe ? { email: user.Email ?? null } : {}),
});

export const toPost = (
  post: Doc,
  extra: { viewerId: string; commentCount: number; savedByMe: boolean }
) => ({
  id: id(post._id),
  author: toUserSummary(post.userId),
  caption: post.caption ?? "",
  images: (post.imageUrl ?? []).map(mediaUrl),
  likeCount: post.likes.length,
  likedByMe: post.likes.some((like: Id) => id(like) === extra.viewerId),
  commentCount: extra.commentCount,
  savedByMe: extra.savedByMe,
  createdAt: post.dateTime,
});

export const toReply = (reply: Doc, usersById: Map<string, Doc>) => ({
  id: reply.replyId,
  author: toUserSummary(usersById.get(id(reply.userId))),
  text: reply.reply,
  createdAt: new Date(reply.dateTime),
});

export const toComment = (comment: Doc, usersById: Map<string, Doc>) => ({
  id: id(comment._id),
  postId: id(comment.postId),
  author: toUserSummary(usersById.get(id(comment.userId))),
  text: comment.comment,
  createdAt: comment.dateTime,
  replies: (comment.replies ?? []).map((reply: Doc) => toReply(reply, usersById)),
});

export const toMessage = (message: Doc) => ({
  id: id(message._id),
  chatId: id(message.chatId),
  senderId: id(message.senderId),
  text: message.message,
  createdAt: message.createdAt,
  editedAt: message.editedAt ?? null,
});

export const toChat = (
  chat: Doc,
  viewerId: string,
  usersById: Map<string, Doc>,
  lastMessage: Doc | null,
  unreadCount = 0
) => ({
  id: id(chat._id),
  // The other people in the chat (not you)
  participants: chat.members
    .filter((member: Id) => id(member) !== viewerId)
    .map((member: Id) => toUserSummary(usersById.get(id(member))))
    .filter(Boolean),
  lastMessage: lastMessage ? toMessage(lastMessage) : null,
  // Messages from the others you haven't read yet
  unreadCount,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

export const toNotification = (notification: Doc, usersById: Map<string, Doc>, postsById: Map<string, Doc>) => {
  const post = notification.postId ? postsById.get(id(notification.postId)) : null;
  return {
    id: id(notification._id),
    type: notification.type as "follow" | "like" | "comment" | "reply" | "story_share",
    actor: toUserSummary(usersById.get(id(notification.actorId))),
    // The post it's about (with its first photo for a thumbnail), if any and still there
    post: post ? { id: id(post._id), imageUrl: mediaUrl(post.imageUrl?.[0]) } : null,
    read: Boolean(notification.read),
    createdAt: notification.createdAt,
  };
};

export const toSuggestion = (user: Doc, mutualCount: number, followedBy: string[]) => ({
  ...toUserSummary(user)!,
  mutualCount,
  // Usernames of up to 2 people you follow who follow them ("Followed by alice and 2 others")
  followedBy,
});
