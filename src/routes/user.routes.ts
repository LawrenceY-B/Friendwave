import multer from "multer";
import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { getFollowers, getFollowing, newFollow, removeFollow } from "../controllers/user";


// const storage= multer.memoryStorage();
// const uploaded = multer({storage})
 const UserRoutes= Router();

 UserRoutes.post('/addFollowing',verifyToken,newFollow)
 UserRoutes.post('/removeFollowing',verifyToken,removeFollow)
 UserRoutes.get('/getFollowing',verifyToken, getFollowing)
 UserRoutes.get('/getFollowers',verifyToken, getFollowers)
//  UserRoutes.get('/register', verifyToken)




 export default UserRoutes