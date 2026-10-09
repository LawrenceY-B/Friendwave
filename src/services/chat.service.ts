import joi from "joi";
import { objectId } from "../lib/validation";
import Chat from "../models/conversation.model";

export const validateChat = (data: unknown) => {
    const schema = joi.object({
       receiverID: objectId().required(),
    });
    return schema.validate(data);
}

export const validateMessage = (data: unknown) => {
    const schema = joi.object({
       message: joi.string().trim().min(1).max(2000).required(),
    });
    return schema.validate(data);
}

// Returns the chat only if the user is one of its members (null otherwise).
// Used by every message endpoint so users can't read or write other people's chats.
export const findChatForMember = (chatId: string, userId: string) =>
    Chat.findOne({ _id: chatId, members: userId });
