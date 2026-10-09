import { Schema, model } from "mongoose";
import { IUser } from "../interfaces/user.interface";
import { mediaUrl } from "../lib/s3";

const UserSchema = new Schema<IUser>({
  UserID: { type: Schema.Types.ObjectId },
  // unique: one Friendwave account per Auth0 user
  Auth0ID: { type: String, required: true, unique: true },
  Name: { type: String, required: true },
  Username: { type: String, required: true },
  // Optional: Apple and some social logins don't share an email
  Email: { type: String },
  EmailVerified: { type: Boolean, },
  // Either an Auth0 picture URL or an S3 key of an uploaded picture
  ProfileUrl: { type: String, get: mediaUrl },
  Bio: { type: String},
  Followers: [{ type: String, ref: "Followers", }],
  Followings: [{ type: String, ref: "Following",}],
  Posts: [{ type: Schema.Types.ObjectId, ref: "Posts",}],
  SavedPosts: [{ type: String, ref: "SavedPosts",}],
  Stories: [{type: Schema.Types.ObjectId, ref: "Stories",}],
}, { toJSON: { getters: true, virtuals: false } });

// Usernames are unique ignoring case ("Lawrence" and "lawrence" clash).
// Queries that should match the same way must pass this collation too.
export const USERNAME_COLLATION = { locale: "en", strength: 2 };
UserSchema.index({ Username: 1 }, { unique: true, collation: USERNAME_COLLATION });

const User = model<IUser>("User", UserSchema);

export default User