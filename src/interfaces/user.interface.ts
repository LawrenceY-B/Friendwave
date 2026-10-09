import { Types } from "mongoose";
export interface IUser{
UserID:Types.ObjectId
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
    userID: Types.ObjectId
    followingID: Types.ObjectId
}export interface IFollower{
    userID:Types.ObjectId
    followerID: Types.ObjectId
}
