import { Request, Response } from "express";
import { Types } from "mongoose";
import Chat from "../models/conversation.model";
import Message from "../models/message.model";
import User from "../models/user.model";
import { toChat, USER_SUMMARY_FIELDS } from "../lib/dto";
import { badRequest, notFound, send } from "../lib/http";
import { findChatForMember, markRead, unreadCounts } from "../services/chat.service";

// Adds the other participants' names/pictures and each chat's last message,
// using one query for all users and one for all last messages.
const buildChats = async (chats: Record<string, any>[], viewerId: string) => {
  const memberIds = [...new Set(chats.flatMap((chat) => chat.members.map(String)))];
  const [users, lastMessages, unread] = await Promise.all([
    User.find({ _id: { $in: memberIds } }).select(USER_SUMMARY_FIELDS).lean(),
    Message.aggregate([
      { $match: { chatId: { $in: chats.map((chat) => chat._id) } } },
      { $sort: { _id: -1 } },
      { $group: { _id: "$chatId", message: { $first: "$$ROOT" } } },
    ]),
    unreadCounts(chats as Parameters<typeof unreadCounts>[0], viewerId),
  ]);
  const usersById = new Map(users.map((user) => [String(user._id), user as Record<string, any>]));
  const lastByChat = new Map(lastMessages.map((m) => [String(m._id), m.message]));
  return chats.map((chat) =>
    toChat(chat, viewerId, usersById, lastByChat.get(String(chat._id)) ?? null, unread.get(String(chat._id)) ?? 0)
  );
};

// GET /chats. Most recently active first. (Not paginated: people have few chats.)
export const getChats = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const chats = await Chat.find({ members: me }).sort({ updatedAt: -1 }).lean();
  send(res, await buildChats(chats, me));
};

// GET /chats/unread. The chats with unread messages (for the red dot on Chats).
export const getUnreadChats = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const chats = await Chat.find({ members: me }).select("_id updatedAt reads").lean();
  const unread = await unreadCounts(chats as Parameters<typeof unreadCounts>[0], me);
  send(res, { chatIds: [...unread.keys()] });
};

// POST /chats/:id/read. Marks it read (you opened it, or a message arrived while it's open).
export const readChat = async (req: Request, res: Response) => {
  await markRead(String(req.params.id), req.user.userID);
  send(res, { chatId: String(req.params.id) });
};

// GET /chats/:id. Members only.
export const getChat = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const chat = await findChatForMember(String(req.params.id), me);
  const [result] = await buildChats([chat], me);
  send(res, result);
};

// POST /chats  { userId }. Returns the existing chat with that person, or creates one.
export const createChat = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const other: string = req.body.userId;
  if (other === me) throw badRequest("You can't start a chat with yourself");
  if (!(await User.exists({ _id: other }))) throw notFound("User");

  const members = [new Types.ObjectId(me), new Types.ObjectId(other)];
  const existing = await Chat.findOne({ members: { $all: members, $size: 2 } }).lean();
  // A new chat starts "read" for both, so only messages sent from now on count as unread
  const now = new Date();
  const chat = existing ?? (await Chat.create({ members, reads: { [me]: now, [other]: now } })).toObject();
  const [result] = await buildChats([chat], me);
  send(res, result, existing ? 200 : 201);
};

// DELETE /chats/:id. Members only; deletes its messages too.
export const deleteChat = async (req: Request, res: Response) => {
  const chat = await findChatForMember(String(req.params.id), req.user.userID);
  await Promise.all([Chat.deleteOne({ _id: chat._id }), Message.deleteMany({ chatId: chat._id })]);
  send(res, null);
};
