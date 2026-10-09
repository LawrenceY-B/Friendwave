import { Types } from "mongoose";

// Shapes of the documents as stored in MongoDB. The API never sends these
// directly; lib/dto.ts turns them into the JSON clients see.
export interface IUser {
  Auth0ID: string;
  Name: string;
  Username: string;
  Email?: string;
  EmailVerified?: boolean;
  // Auth0 picture URL, or the S3 key of an uploaded picture
  ProfileUrl?: string;
  Bio?: string;
}

// "userID follows followingID". The only record of who follows whom.
export interface IFollowing {
  userID: Types.ObjectId;
  followingID: Types.ObjectId;
  createdAt: Date;
}
