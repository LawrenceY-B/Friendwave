import { Request, Response, NextFunction } from "express";
import Message from "../models/message.model";
import { findChatForMember, validateMessage } from "../services/chat.service";

export const newMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = validateMessage(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const senderId = req.user.userID;
    const chatId = String(req.params.id);
    if (!(await findChatForMember(chatId, senderId))) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // Without `await`, save() returns a Promise, which is always truthy,
    // and any database error would be lost.
    const sent = await Message.create({
      message: req.body.message,
      senderId,
      chatId,
      dateTime: Date.now(),
    });
    res.status(200).json({ success: true, message: "Message Sent", data: sent });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (
    req:Request,
    res:Response,
    next:NextFunction
)=>{
    try {
        const chatId = String(req.params.id);
        if (!(await findChatForMember(chatId, req.user.userID))) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }
        const getMessage = await Message.find({chatId: chatId}).sort({ createdAt: 1 })
        res.status(200).json({success: true, message: "Messages Found", data:getMessage });

    } catch (error) {
        next(error)
    }
}

export const deleteMessage = async (
    req:Request,
    res:Response,
    next:NextFunction
) => {
    try {
        const {messageId} = req.params;
        // Matching on senderId means you can only delete your own messages
        const deleted = await Message.findOneAndDelete({ _id: messageId, senderId: req.user.userID });
        if(!deleted){
            return res.status(404).json({success: false, message: "Message not found" });
        }
        res.status(200).json({success: true, message: "Message deleted" });
    } catch (error) {
       next(error);
    }
}

export const editMessage = async (
    req:Request,
    res:Response,
    next:NextFunction
) => {
    try {
        const { error } = validateMessage(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        const {messageId} = req.params;
        const edited = await Message.findOneAndUpdate(
            { _id: messageId, senderId: req.user.userID },
            { message: req.body.message }
        );
        if(!edited){
            return res.status(404).json({success: false, message: "Message not found" });
        }
        res.status(200).json({success: true, message: "Message edited" });
    } catch (error) {
        next(error);
    }
}
