import { Schema, model } from "mongoose";
import { IPost } from "../interfaces/post.interface";
import { mediaUrl } from "../lib/s3";

const PostSchema = new Schema<IPost>({
    postId:{type:Schema.Types.ObjectId},
    userId:{type: Schema.Types.ObjectId, ref: "User", required: true},
    // Stores S3 keys; the getter turns them into links when sent as JSON
    imageUrl:[{type:String, get: mediaUrl}],
    caption:{type:String},
    likes:[{type:Schema.Types.ObjectId, ref:"User"}],
    comments:[{type:Schema.Types.ObjectId, ref:"Comment"}],
    dateTime:{type:Date},
    // saved:{type:Boolean}
}, { toJSON: { getters: true, virtuals: false } });

const Post = model<IPost>("Posts", PostSchema);

export default Post