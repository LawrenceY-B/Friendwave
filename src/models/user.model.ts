import { Schema, model } from "mongoose";
import { IUser } from "../interfaces/user.interface";
import { mediaUrl } from "../lib/s3";

const UserSchema = new Schema<IUser>({
  UserID: { type: Schema.Types.ObjectId },
  Auth0ID: { type: String, required: true },
  Name: { type: String, required: true },
  Username: { type: String, required: true },
  Email: { type: String, required: true },
  EmailVerified: { type: Boolean, },
  // Either an Auth0 picture URL or an S3 key of an uploaded picture
  ProfileUrl: { type: String, required: true, get: mediaUrl },
  Bio: { type: String},
  Followers: [{ type: String, ref: "Followers", }],
  Followings: [{ type: String, ref: "Following",}],
  Posts: [{ type: Schema.Types.ObjectId, ref: "Posts",}],
  SavedPosts: [{ type: String, ref: "SavedPosts",}],
  Stories: [{type: Schema.Types.ObjectId, ref: "Stories",}],
}, { toJSON: { getters: true, virtuals: false } });

const User = model<IUser>("User", UserSchema);

export default User