import { Schema, model } from "mongoose";
import { IPost } from "../interfaces/post.interface";

const PostSchema = new Schema<IPost>({
    postId:{type:Schema.Types.ObjectId},
    userId:{type: Schema.Types.ObjectId, ref: "User", required: true},
    imageUrl:[{type:String}],
    caption:{type:String},
    likes:[{type:Schema.Types.ObjectId,ref:"Like"}],
    comments:[{type:Schema.Types.ObjectId,ref:"Comment"}],
    dateTime:{type:Date}
});

const Post = model<IPost>("Post", PostSchema);

export default Post