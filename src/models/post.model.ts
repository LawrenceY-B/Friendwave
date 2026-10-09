import { Schema, model } from "mongoose";
import { IPost } from "../interfaces/post.interface";

const PostSchema = new Schema<IPost>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  imageUrl: [{ type: String }],
  caption: { type: String },
  likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
  dateTime: { type: Date, default: Date.now },
});

const Post = model<IPost>("Posts", PostSchema);

export default Post
