import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { newChat } from "../controllers/chats";

const ChatRoutes = Router();

ChatRoutes.post("/", verifyToken, newChat);

export default ChatRoutes;