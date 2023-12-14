import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { deleteChat, getAllChats, newChat } from "../controllers/chats";

const ChatRoutes = Router();

ChatRoutes.post("/", verifyToken, newChat);
ChatRoutes.get("/allchats", verifyToken, getAllChats);
ChatRoutes.delete("/deletechat/:id", verifyToken, deleteChat)

export default ChatRoutes;