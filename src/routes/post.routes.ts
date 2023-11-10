import multer from "multer";
import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { newPost } from "../controllers/post";

const PostRoutes = Router();

const storage= multer.memoryStorage();
const upload = multer({storage})
const PostUpload=upload.array('images',10)

PostRoutes.post('/newpost',PostUpload,verifyToken,newPost)

export default PostRoutes