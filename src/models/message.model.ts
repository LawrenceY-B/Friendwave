import { Schema, model } from "mongoose";
import { IMessage } from "../interfaces/chat.interface";

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    message: { type: String, required: true },
    editedAt: { type: Date },
  },
  { timestamps: true }
);

const Message = model<IMessage>("Messages", MessageSchema);

export default Message;
