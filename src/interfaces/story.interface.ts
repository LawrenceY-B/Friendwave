import { Types } from "mongoose";

export interface IStories {
  storyId: string;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  expireAt: Date;
  createdAt: Date;
}
