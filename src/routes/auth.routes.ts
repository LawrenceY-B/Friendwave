import multer from "multer";
import express,{Router} from "express";
import {requiresAuth } from "express-openid-connect";
import { Login } from "../controllers/auth";


// const storage= multer.memoryStorage();
// const uploaded = multer({storage})
const app=express();
 const Authroutes= Router();

 Authroutes.get('/login',requiresAuth(),Login)




 export default Authroutes