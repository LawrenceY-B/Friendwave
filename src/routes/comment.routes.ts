import { Router } from "express";
import { validate } from "../middleware/validate";
import { idParams } from "../lib/validation";
import { replyParams, textBody } from "../services/post.service";
import { createReply, deleteComment, deleteReply } from "../controllers/comment";

const CommentRoutes = Router();

CommentRoutes.delete("/:id", validate({ params: idParams }), deleteComment);
CommentRoutes.post("/:id/replies", validate({ params: idParams, body: textBody }), createReply);
CommentRoutes.delete("/:id/replies/:replyId", validate({ params: replyParams }), deleteReply);

export default CommentRoutes;
