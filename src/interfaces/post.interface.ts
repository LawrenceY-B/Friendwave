import { Types } from "mongoose";

export interface IPost {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  imageUrl: string []; // URL or reference to the image or video
  caption: string;
  likes: Types.ObjectId[]; // Array of user IDs who liked the post
  comments: any[]; // Array of comment IDs
  dateTime: Date; // Date and time of the post in ISO format (e.g., "2023-11-10T12:34:56.789Z")
  saved: boolean;

}

export interface ISavedPost {
  userId: Types.ObjectId;
  postId: Types.ObjectId;
}

export interface IComment {
  commentId: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  replies: IReplies[];
  comment: string;
  dateTime: Date;
}
export interface IReplies{
  replyId: string;
  userId: string;
  commentId: Types.ObjectId;
  reply: string;
  dateTime: any;
}
