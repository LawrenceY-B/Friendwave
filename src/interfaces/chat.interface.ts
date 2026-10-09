import { Types } from "mongoose";

export interface IChats{
    members:Types.ObjectId[];
}
export interface IMessage{
    chatId:any;
    senderId:Types.ObjectId;
    message:string;
    dateTime:Date;
}