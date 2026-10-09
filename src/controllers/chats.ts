import { Request, Response, NextFunction } from "express";
import { validateChat } from "../services/chat.service";
import Chat from "../models/conversation.model";
import Message from "../models/message.model";
import User from "../models/user.model";

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
    const userID = req.user.userID;
    const { receiverID } = req.body;

    if (receiverID === userID) {
      return res
        .status(400)
        .json({ success: false, message: "Can't start a chat with yourself" });
    }
    if (!(await User.exists({ _id: receiverID }))) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isExisting = await Chat.findOne({
      members: { $all: [userID, receiverID] },
    });
    if (isExisting) {
      return res
        .status(400)
        .json({ success: false, message: "Chat already exists" });
    }
    // create() saves once; a failed save throws, so no "if (!saved)" check is needed
    await Chat.create({ members: [userID, receiverID] });

    res.status(201).json({ success: true, message: "Chat created" });
  } catch (error) {
    // An empty catch {} hides the error AND leaves the request hanging
    next(error);
  }
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
        // Only a member of the chat can delete it
        const chat = await Chat.findOneAndDelete({ _id: chatID, members: req.user.userID });
        if (!chat) {
            return res
                .status(404)
                .json({ success: false, message: "Chat does not exist" });
        }
        await Message.deleteMany({ chatId: chat._id });
        res.status(200).json({ success: true, message: "Chat deleted" });
    } catch (error) {
        next(error);
    }
}
