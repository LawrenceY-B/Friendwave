import { Schema, model } from "mongoose";
import { IStories } from "../interfaces/story.interface";

const StoriesSchema = new Schema<IStories>(
  {
    storyId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Posts", required: true },
    expireAt: {
      type: Date,
      default: () => Date.now() + 24 * 60 * 60 * 1000, // expires in 24 hours
      expires: 60 * 60 * 24,
    },
  },
  { timestamps: true }
);

const Stories = model<IStories>("Stories", StoriesSchema);

export default Stories;
