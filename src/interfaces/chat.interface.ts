import { Types } from "mongoose";

export interface IChats {
  members: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date; // bumped on every new message, so chats sort by activity
  // When each member last read the chat (userId → time); unread = others' messages after it
  reads?: Map<string, Date>;
}

export interface IMessage {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  message: string; // "" for a photo without a caption
  imageUrl?: string; // S3 key of a photo, if the message has one
  editedAt?: Date;
  createdAt: Date;
}
