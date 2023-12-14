import { Schema } from "mongoose";
export interface IUser{
UserID:Schema.Types.ObjectId
Auth0ID: string;
Username: string;
Name: string;
Email: string;
EmailVerified: boolean;
Password: string;
ProfileUrl: string;
Bio: string;
Followers: any[];
Followings: any[];
Posts:any[];
Likes: any;
Comments: any;
SavedPosts:any[]
Stories: any[];

}
export interface IFollowing{
    userID: Schema.Types.ObjectId
    followingID: Schema.Types.ObjectId
}export interface IFollower{
    userID:Schema.Types.ObjectId
    followerID: Schema.Types.ObjectId
}
