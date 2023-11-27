import { Schema } from "mongoose";

export interface IPost {
  postId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  imageUrl: string []; // URL or reference to the image or video
  caption: string;
  likes: Schema.Types.ObjectId[]; // Array of user IDs who liked the post
  comments: any[]; // Array of comment IDs
  dateTime: Date; // Date and time of the post in ISO format (e.g., "2023-11-10T12:34:56.789Z")
  saved: boolean;

}

export interface ISavedPost {
  userId: Schema.Types.ObjectId;
  postId: Schema.Types.ObjectId;
}

export interface IComment {
  commentId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  postId: Schema.Types.ObjectId;
  replies: IReplies[];
  comment: string;
  dateTime: Date;
}
export interface IReplies{
  userId: Schema.Types.ObjectId;
  commentId: Schema.Types.ObjectId;
  reply: string;
  dateTime: any;
}
