import { Request, Response, NextFunction } from "express";
import Message from "../models/message.model";
import Logger from "../lib/logger";
import { IMessage } from "../interfaces/chat.interface";

export const newMessage = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    const senderId = req.user.userID;
    const chatId = req.params.id;
    const newMessage = {
      message,
      senderId,
      chatId,

    };

    const sendMessage = new Message({ ...newMessage, dateTime: Date.now()
    });
    let isSaved = sendMessage.save();
    if (!isSaved) {
      res.status(400).json({success:"false", message: "Message not sent" });
    }
    res.status(200).json({success:"true", message: "Message Sent" });
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
        const chatId = req.params.id;
        const getMessage = await Message.find({chatId: chatId})
        if(!getMessage){
            res.status(400).json({success:"false", message: "No Messages" });
        }
        res.status(200).json({success:"true", message: "Messages Found", data:getMessage });
        
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
        
    } catch (error) {
        
    }
}