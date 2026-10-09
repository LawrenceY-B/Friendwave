import { Types } from "mongoose";

export interface IPost {
  userId: Types.ObjectId;
  imageUrl: string[]; // S3 keys
  caption?: string;
  likes: Types.ObjectId[]; // users who liked the post
  dateTime: Date; // when it was posted
}

export interface ISavedPost {
  userId: Types.ObjectId;
  postId: Types.ObjectId;
}

export interface IReply {
  replyId: string;
  userId: string;
  reply: string;
  dateTime: Date | number; // older replies stored a timestamp number
}

export interface IComment {
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  replies: IReply[];
  comment: string;
  dateTime: Date;
}
