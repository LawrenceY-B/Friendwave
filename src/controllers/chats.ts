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
    const { senderID, receiverID } = req.body;

    const isExisting = await Chat.findOne({
      members: { $all: [senderID, receiverID] },
    });
    if (isExisting) {
      return res
        .status(400)
        .json({ success: false, message: "Chat already exists" });
    }
    let members = [senderID, receiverID];
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

//delete chat
