import { Request, Response } from "express";
import Message from "../models/message.model";
import Chat from "../models/conversation.model";
import { toMessage } from "../lib/dto";
import { notFound, pageFrom, paginate, send, sendPage } from "../lib/http";
import { emitToUsers } from "../lib/realtime";
import { findChatForMember, sendMessage } from "../services/chat.service";

// GET /chats/:id/messages. Newest first; use nextCursor to load older ones.
export const getMessages = async (req: Request, res: Response) => {
  const chat = await findChatForMember(String(req.params.id), req.user.userID);
  const { items, nextCursor } = await paginate(
    (filter) => Message.find(filter).lean(),
    { chatId: chat._id },
    pageFrom(req)
  );
  sendPage(res, items.map(toMessage), nextCursor);
};

// POST /chats/:id/messages  { text }. Also delivered live as "message:new".
export const createMessage = async (req: Request, res: Response) => {
  send(res, await sendMessage(String(req.params.id), req.user.userID, req.body.text), 201);
};

// Finds a message the current user sent (anyone else gets "not found")
const findOwnMessage = async (messageId: string, userId: string) => {
  const message = await Message.findOne({ _id: messageId, senderId: userId }).lean();
  if (!message) throw notFound("Message");
  return message;
};

const membersOf = async (chatId: unknown) =>
  (await Chat.findById(chatId).select("members").lean())?.members ?? [];

// PATCH /messages/:id  { text }. Sender only. Delivered live as "message:updated".
export const editMessage = async (req: Request, res: Response) => {
  const own = await findOwnMessage(String(req.params.id), req.user.userID);
  const updated = await Message.findByIdAndUpdate(
    own._id,
    { message: req.body.text, editedAt: new Date() },
    { returnDocument: "after" }
  ).lean();
  const message = toMessage(updated!);
  emitToUsers(await membersOf(own.chatId), "message:updated", message);
  send(res, message);
};

// DELETE /messages/:id. Sender only. Delivered live as "message:deleted".
export const deleteMessage = async (req: Request, res: Response) => {
  const own = await findOwnMessage(String(req.params.id), req.user.userID);
  await Message.deleteOne({ _id: own._id });
  emitToUsers(await membersOf(own.chatId), "message:deleted", { id: String(own._id), chatId: String(own.chatId) });
  send(res, null);
};
