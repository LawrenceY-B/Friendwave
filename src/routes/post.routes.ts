import multer from "multer";
import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { AddtoSaved, RemoveFromSaved, addLikes, createComment, deleteComment, deletePost, getAllComments, newPost, replyComment, unlike } from "../controllers/post";

const PostRoutes = Router();

const storage= multer.memoryStorage();
const upload = multer({storage})
const PostUpload=upload.array('images',10)

PostRoutes.post('/newpost',PostUpload,verifyToken,newPost)
PostRoutes.post('/deletepost',verifyToken,deletePost)
PostRoutes.post('/likepost',verifyToken, addLikes)
PostRoutes.post('/unlikepost',verifyToken, unlike)

// routes for saved post
PostRoutes.post('/savepost',verifyToken, AddtoSaved)
PostRoutes.post('/removesaved', verifyToken, RemoveFromSaved)


//routes for comments
PostRoutes.post('/comment',verifyToken, createComment)
PostRoutes.post('/allcomments',verifyToken, getAllComments)
PostRoutes.delete('/removecomment',verifyToken, deleteComment)
PostRoutes.post('/replycomment',verifyToken, replyComment)


export default PostRoutes