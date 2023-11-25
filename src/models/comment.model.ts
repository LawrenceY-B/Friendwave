import { Schema, model } from "mongoose";
import { IFollowing } from "../interfaces/user.interface";
import { IComment } from "../interfaces/post.interface";

const CommentSchema = new Schema<IComment>({
userId: { type: Schema.Types.ObjectId,ref:"User", required: true },
postId: { type: Schema.Types.ObjectId, ref:"Post",  required:true},
replies: [{type: String }],
comment: { type: String, required: true },
dateTime: { type: Date, required: true},
});

const Comment = model<IComment>("Comment", CommentSchema);

export default Comment