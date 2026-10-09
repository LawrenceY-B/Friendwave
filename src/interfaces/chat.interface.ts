import { Types } from "mongoose";

export interface IChats {
  members: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date; // bumped on every new message, so chats sort by activity
}

export interface IMessage {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  message: string;
  editedAt?: Date;
  createdAt: Date;
}
