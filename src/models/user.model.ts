import { Schema, model } from "mongoose";
import { IUser } from "../interfaces/user.interface";

const UserSchema = new Schema<IUser>({
  UserID: { type: Schema.Types.ObjectId },
  Auth0ID: { type: String, required: true },
  Name: { type: String, required: true },
  Username: { type: String, required: true },
  Email: { type: String, required: true },
  EmailVerified: { type: Boolean, },
  ProfileUrl: { type: String, required: true },
  Bio: { type: String},
  Followers: [{ type: String, ref: "Followers", }],
  Followings: [{ type: String, ref: "Following",}],
  Posts: [{ type: Schema.Types.ObjectId, ref: "Posts",}],
  SavedPosts: [{ type: String, ref: "SavedPosts",}],
  Stories: [{type: Schema.Types.ObjectId, ref: "Stories",}],
});

const User = model<IUser>("User", UserSchema);

export default User