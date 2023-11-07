import { Schema, model } from "mongoose";
import { IFollowing } from "../interfaces/user.interface";

const FollowingSchema = new Schema<IFollowing>({
userID: { type: Schema.Types.ObjectId, required: true },
followingID: { type: Schema.Types.ObjectId, ref:"User", required:true}
});

const Following = model<IFollowing>("Following", FollowingSchema);

export default Following