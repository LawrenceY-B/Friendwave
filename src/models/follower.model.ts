import { Schema, model } from "mongoose";
import { IFollower } from "../interfaces/user.interface";

const FollowerSchema = new Schema<IFollower>({
userID: { type: Schema.Types.ObjectId, required: true },
followerID: { type: Schema.Types.ObjectId,ref:"User", required:true}
});

const Follower = model<IFollower>("Follower", FollowerSchema);

export default Follower