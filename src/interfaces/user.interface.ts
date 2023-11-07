import { Schema } from "mongoose";
export interface IUser{
UserID:Schema.Types.ObjectId
Auth0ID: string;
Username: string;
Email: string;
EmailVerified: boolean;
Password: string;
ProfileUrl: string;
Bio: string;
Followers: string;
Followings: string;
Posts:any;
Likes: any;
Comments: any;
SavedPosts:any

}
export interface IFollowing{
    userID: Schema.Types.ObjectId
    followingID: Schema.Types.ObjectId
}export interface IFollower{
    userID:Schema.Types.ObjectId
    followerID: Schema.Types.ObjectId
}

// {
//     sid: 'uoJtyV4JLXVjNLdthupQdP3Vw_pIzwLR',
//     given_name: 'Lawrence',
//     family_name: 'Yirenkyi-Boafo',
//     nickname: 'lawrencekybj',
//     name: 'Lawrence Yirenkyi-Boafo',
//     picture: 'https://lh3.googleusercontent.com/a/ACg8ocLVbC-gEPtVGi4n5sLY4pX6A2VfGfRpcCZ557B0kXX--OA=s96-c',
//     locale: 'en',
//     updated_at: '2023-11-03T13:31:27.354Z',
//     email: 'lawrencekybj@gmail.com',
//     email_verified: true,
//     sub: 'google-oauth2|118190511757608158997'
//   }