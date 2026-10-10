import { Router } from "express";
import { validate } from "../middleware/validate";
import { pageOnly } from "../lib/validation";
import { getFeed } from "../controllers/post";
import UserRoutes from "./user.routes";
import PostRoutes from "./post.routes";
import CommentRoutes from "./comment.routes";
import StoryRoutes from "./story.routes";
import ChatRoutes from "./chat.routes";
import MessageRoutes from "./message.routes";
import NotificationRoutes from "./notification.routes";

// Every route in here requires a logged-in user (app.ts applies verifyToken)
const ApiRoutes = Router();

ApiRoutes.get("/feed", validate({ query: pageOnly }), getFeed);
ApiRoutes.use("/users", UserRoutes);
ApiRoutes.use("/posts", PostRoutes);
ApiRoutes.use("/comments", CommentRoutes);
ApiRoutes.use("/stories", StoryRoutes);
ApiRoutes.use("/chats", ChatRoutes);
ApiRoutes.use("/messages", MessageRoutes);
ApiRoutes.use("/notifications", NotificationRoutes);

export default ApiRoutes;
