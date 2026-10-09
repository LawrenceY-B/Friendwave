import joi from "joi";
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
  // Bump the chat so the chat list can show the most recent conversation first
  await Chat.updateOne({ _id: chat._id }, { $set: { updatedAt: new Date() } }, { timestamps: false });

  const message = toMessage(saved.toObject());
  // Sent to every member, including the sender's other tabs/devices
  emitToUsers(chat.members, "message:new", message);
  return message;
};
