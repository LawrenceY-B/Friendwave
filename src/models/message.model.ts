import { Schema, model } from "mongoose";
import { IMessage } from "../interfaces/chat.interface";

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: Schema.Types.ObjectId },
    senderId: { type: Schema.Types.ObjectId },
    message: { type: String },
    dateTime: { type: Date },
    // saved:{type:Boolean}
  },
  { timestamps: true }
);

const Message = model<IMessage>("Messages", MessageSchema);

export default Message;
