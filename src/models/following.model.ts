import { Schema, model } from "mongoose";
import { IFollowing } from "../interfaces/user.interface";

// "userID follows followingID". Followers of X = documents with followingID X.
const FollowingSchema = new Schema<IFollowing>(
  {
    userID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followingID: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// You can follow someone only once
FollowingSchema.index({ userID: 1, followingID: 1 }, { unique: true });

const Following = model<IFollowing>("Following", FollowingSchema);

export default Following
