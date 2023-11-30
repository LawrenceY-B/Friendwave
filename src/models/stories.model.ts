import { Schema, model } from "mongoose";
import { IFollowing } from "../interfaces/user.interface";
import { IStories } from "../interfaces/story.interface";

const StoriesSchema = new Schema<IStories>(
  {
    storyId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Posts", required: true },
    expireAt: { type: Date,  default: Date.now, index: { expires: '4h' }},
  },
  { timestamps: true }
);

const Stories = model<IStories>("Stories", StoriesSchema);

export default Stories;
