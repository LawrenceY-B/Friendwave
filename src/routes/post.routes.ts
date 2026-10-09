import { Router } from "express";
import upload from "../middleware/upload";
import { validate } from "../middleware/validate";
import { idParams, pageOnly } from "../lib/validation";
import { createPostBody, textBody } from "../services/post.service";
import { createPost, deletePost, getPost, like, save, unlike, unsave } from "../controllers/post";
import { createComment, getComments } from "../controllers/comment";

const PostRoutes = Router();

PostRoutes.post("/", upload.array("images", 10), validate({ body: createPostBody }), createPost);
PostRoutes.get("/:id", validate({ params: idParams }), getPost);
PostRoutes.delete("/:id", validate({ params: idParams }), deletePost);

PostRoutes.post("/:id/like", validate({ params: idParams }), like);
PostRoutes.delete("/:id/like", validate({ params: idParams }), unlike);
PostRoutes.post("/:id/save", validate({ params: idParams }), save);
PostRoutes.delete("/:id/save", validate({ params: idParams }), unsave);

PostRoutes.get("/:id/comments", validate({ params: idParams, query: pageOnly }), getComments);
PostRoutes.post("/:id/comments", validate({ params: idParams, body: textBody }), createComment);

export default PostRoutes
