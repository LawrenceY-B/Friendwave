import { Schema, model } from "mongoose";
import { ISavedPost } from "../interfaces/post.interface";

const SavedPostSchema = new Schema<ISavedPost>({
  postId: { type: Schema.Types.ObjectId, ref: "Posts", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
});
// A post can be saved only once per user
SavedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });

const SavedPost = model<ISavedPost>("SavedPosts", SavedPostSchema);

export default SavedPost;
