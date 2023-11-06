import multer from "multer";
import express,{Router} from "express";
import {requiresAuth } from "express-openid-connect";
import { Login,Logout} from "../controllers/auth";
import { verifyToken } from "../middleware/isAuthorized";


// const storage= multer.memoryStorage();
// const uploaded = multer({storage})
const app=express();
 const Authroutes= Router();

 Authroutes.get('/login',requiresAuth(),Login)
 Authroutes.get('/logout', Logout)
//  Authroutes.get('/register', verifyToken)




 export default Authroutes