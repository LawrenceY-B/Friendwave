import { Request, Response, NextFunction } from "express";
import { validateChat } from "../services/chat.service";
import Chat from "../models/conversation.model";
import Logger from "../lib/logger";

// new chat
export const newChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateChat(req.body);
    if (error)
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
     const userID = req.user.userID  
    const {receiverID } = req.body;

    const isExisting = await Chat.findOne({
      members: { $all: [userID, receiverID] },
    });
    if (isExisting) {
      return res
        .status(400)
        .json({ success: false, message: "Chat already exists" });
    }
    let members = [userID, receiverID];
    const chat = new Chat({ members });
    const savechat = await chat.save();
    if (!savechat) {
      Logger.error("Something went wrong");
      return res
        .status(400)
        .json({ success: false, message: "Something went wrong" });
    }

    res.status(201).json({ success: true, message: "Chat created" });

    await chat.save();
  } catch (error) {}
};

//get chat
export const getAllChats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const senderID = req.user.userID;
    const chat = await Chat.find({
      members: { $in: [senderID] },
    });
    if (!chat) {
      return res
        .status(400)
        .json({ success: false, message: "Chat does not exist" });
    }
    res.status(200).json({ success: true, message: "Chat found", chat });
  } catch (error) {
    next(error);
  }
};

//delete chat
export const deleteChat = async (
    req: Request,
    res:Response,
    next: NextFunction
) => {
    try {
        const chatID = req.params.id;        
        const chat = await Chat.findByIdAndDelete(chatID);
        if (!chat) {
            return res
                .status(400)
                .json({ success: false, message: "Chat does not exist" });
        }
        res.status(200).json({ success: true, message: "Chat deleted" });
    } catch (error) {
        next(error);
    }
}