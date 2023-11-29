import { Schema } from "mongoose";

export interface IStories {
    storyId: string;
    userId: Schema.Types.ObjectId;
    postId: Schema.Types.ObjectId;
    expireAt: Date;
}