import multer from "multer";
import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { getFollowers, getFollowing, newFollow, removeFollow, unFollow } from "../controllers/user";


// const storage= multer.memoryStorage();
// const uploaded = multer({storage})
 const UserRoutes= Router();

 UserRoutes.post('/addFollowing',verifyToken,newFollow)
 UserRoutes.post('/unfollow',verifyToken,unFollow)
 UserRoutes.get('/getFollowing',verifyToken, getFollowing)
 UserRoutes.get('/getFollowers',verifyToken, getFollowers)
 UserRoutes.post('/removeFollower',verifyToken, removeFollow)
//  UserRoutes.get('/register', verifyToken)




 export default UserRoutes