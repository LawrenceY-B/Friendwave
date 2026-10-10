import joi from "joi";
import { Types } from "mongoose";
import Chat from "../models/conversation.model";
import Message from "../models/message.model";
import { objectId } from "../lib/validation";
import { toMessage } from "../lib/dto";
import { emitToUsers } from "../lib/realtime";
import { badRequest, notFound } from "../lib/http";

export const createChatBody = joi.object({
  userId: objectId().required(),
});

export const messageBody = joi.object({
  text: joi.string().trim().min(1).max(2000).required(),
});

// Returns the chat only if the user is one of its members (404 otherwise, so
// strangers can't even tell whether a chat id exists).
export const findChatForMember = async (chatId: string, userId: string) => {
  const chat = await Chat.findOne({ _id: chatId, members: userId }).lean();
  if (!chat) throw notFound("Chat");
  return chat;
};

// Shared by POST /chats/:id/messages and the socket "message:send" event, so
// both behave exactly the same: check membership, save, then push it live.
export const sendMessage = async (chatId: string, senderId: string, text: string) => {
  const { error, value } = messageBody.validate({ text });
  if (error) throw badRequest(error.details[0].message.replace(/"/g, ""));
  const chat = await findChatForMember(chatId, senderId);

  const saved = await Message.create({ chatId: chat._id, senderId, message: value.text });
  // Bump the chat so the chat list can show the most recent conversation first. Replying means
  // you've read it; members with no read time yet (chats from before read tracking) get the
  // previous activity time, so this message counts as unread for them.
  const reads: Record<string, Date> = { [`reads.${senderId}`]: saved.get("createdAt") };
  for (const member of chat.members.map(String))
    if (member !== senderId && !readsOf(chat)[member]) reads[`reads.${member}`] = chat.updatedAt;
  await Chat.updateOne({ _id: chat._id }, { $set: { updatedAt: new Date(), ...reads } }, { timestamps: false });

  const message = toMessage(saved.toObject());
  // Sent to every member, including the sender's other tabs/devices
  emitToUsers(chat.members, "message:new", message);
  return message;
};

// ---- unread ----

type ChatForUnread = { _id: Types.ObjectId; updatedAt: Date; reads?: Map<string, Date> | Record<string, Date> };

// .lean() turns the Map into a plain object
const readsOf = (chat: { reads?: Map<string, Date> | Record<string, Date> }): Record<string, Date> =>
  chat.reads instanceof Map ? Object.fromEntries(chat.reads) : (chat.reads ?? {});

// When `userId` last read the chat. Chats from before read tracking have no entry: count
// from their last activity, so old conversations don't all light up as unread.
const readTime = (chat: ChatForUnread, userId: string) => readsOf(chat)[userId] ?? chat.updatedAt;

// Unread messages per chat for `userId`: messages from the others, newer than their read time
export const unreadCounts = async (chats: ChatForUnread[], userId: string): Promise<Map<string, number>> => {
  if (chats.length === 0) return new Map();
  const rows = await Message.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        senderId: { $ne: new Types.ObjectId(userId) },
        $or: chats.map((chat) => ({ chatId: chat._id, createdAt: { $gt: readTime(chat, userId) } })),
      },
    },
    { $group: { _id: "$chatId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

// Marks the chat read for `userId` now, and tells their other tabs/devices
export const markRead = async (chatId: string, userId: string) => {
  const chat = await findChatForMember(chatId, userId);
  await Chat.updateOne({ _id: chat._id }, { $set: { [`reads.${userId}`]: new Date() } }, { timestamps: false });
  emitToUsers([userId], "chat:read", { chatId: String(chat._id) });
};
