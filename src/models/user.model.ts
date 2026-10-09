import { Schema, model } from "mongoose";
import { IUser } from "../interfaces/user.interface";

const UserSchema = new Schema<IUser>({
  // unique: one Friendwave account per Auth0 user
  Auth0ID: { type: String, required: true, unique: true },
  Name: { type: String, required: true },
  Username: { type: String, required: true },
  // Optional: Apple and some social logins don't share an email
  Email: { type: String },
  EmailVerified: { type: Boolean },
  // Either an Auth0 picture URL or an S3 key of an uploaded picture
  ProfileUrl: { type: String },
  Bio: { type: String },
});
// Posts, followers, saved posts etc. are NOT stored on the user: they're
// queried from their own collections, so there's only one place to keep correct.

// Usernames are unique ignoring case ("Lawrence" and "lawrence" clash).
// Queries that should match the same way must pass this collation too.
export const USERNAME_COLLATION = { locale: "en", strength: 2 };
UserSchema.index({ Username: 1 }, { unique: true, collation: USERNAME_COLLATION });

const User = model<IUser>("User", UserSchema);

export default User
