import { Schema, model } from "mongoose";
import { IComment } from "../interfaces/post.interface";

const CommentSchema = new Schema<IComment>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  postId: { type: Schema.Types.ObjectId, ref: "Posts", required: true, index: true },
  replies: [],
  comment: { type: String, required: true },
  dateTime: { type: Date, default: Date.now },
});

const Comment = model<IComment>("Comment", CommentSchema);

export default Comment
