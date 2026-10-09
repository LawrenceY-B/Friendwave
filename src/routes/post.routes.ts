import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import upload from "../middleware/upload";
import { AddtoSaved, RemoveFromSaved, addLikes, createComment, deleteComment, deletePost, deleteReply, getAllComments, getPost, newPost, replyComment, unlike } from "../controllers/post";

const PostRoutes = Router();

const PostUpload=upload.array('images',10)

// verifyToken runs first, so files are only read for logged-in users
PostRoutes.post('/newpost',verifyToken,PostUpload,newPost)
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
PostRoutes.delete('/removereply',verifyToken, deleteReply)

// registered last so it doesn't swallow the fixed paths above
PostRoutes.get('/:postId',verifyToken, getPost)


export default PostRoutes
