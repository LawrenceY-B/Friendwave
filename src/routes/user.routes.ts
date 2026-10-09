import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import upload from "../middleware/upload";
import { getFollowers, getFollowing, newFollow, removeFollow, unFollow, AddBio, deleteBio, getUser, editProfile, getotherUser, searchUser } from "../controllers/user";


 const UserRoutes= Router();
//following & unfollowing functions
 UserRoutes.post('/addFollowing',verifyToken,newFollow)
 UserRoutes.post('/unfollow',verifyToken,unFollow)
 UserRoutes.get('/getFollowing',verifyToken, getFollowing)
 UserRoutes.get('/getFollowers',verifyToken, getFollowers)
 UserRoutes.post('/removeFollower',verifyToken, removeFollow)


 UserRoutes.get('/getUser',verifyToken, getUser)
 UserRoutes.get('/getuserprofile',verifyToken, getotherUser)
 UserRoutes.post('/searchuser',verifyToken,searchUser)


 //Bio & profile
 UserRoutes.post('/addBio',verifyToken, AddBio)
 UserRoutes.delete('/deleteBio',verifyToken, deleteBio)
 // verifyToken runs first, so files are only read for logged-in users
 UserRoutes.put('/editprofile',verifyToken,upload.single('images'), editProfile)


 export default UserRoutes
