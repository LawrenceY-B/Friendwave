import { Schema, model } from "mongoose";
import { ISavedPost } from "../interfaces/post.interface";

const SavedPostSchema = new Schema<ISavedPost>({
  postId: { type: Schema.Types.ObjectId, ref: "Posts", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

const SavedPost = model<ISavedPost>("SavedPosts", SavedPostSchema);

export default SavedPost;
