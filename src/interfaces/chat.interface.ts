import { Schema } from "mongoose";

export interface IChats{
    members:Schema.Types.ObjectId[];
}
export interface IMessage{
    chatId:any;
    senderId:Schema.Types.ObjectId;
    message:string;
    dateTime:Date;
}