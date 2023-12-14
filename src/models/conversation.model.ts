import { Schema, model } from "mongoose";
import { IChats } from "../interfaces/chat.interface";

const ChatsSchema = new Schema<IChats>(
  {
    members: [{ type: Schema.Types.ObjectId }],
  },
  { timestamps: true }
);

const Chat = model<IChats>("Chats", ChatsSchema);

export default Chat;