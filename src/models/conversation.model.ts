import { Schema, model } from "mongoose";
import { IChats } from "../interfaces/chat.interface";

const ChatsSchema = new Schema<IChats>(
  {
    members: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], index: true },
  },
  { timestamps: true }
);

const Chat = model<IChats>("Chats", ChatsSchema);

export default Chat;
