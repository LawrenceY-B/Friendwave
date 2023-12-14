import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { deleteMessage, editMessage, getMessages, newMessage } from "../controllers/message";

const MessageRoutes = Router();

MessageRoutes.post("/:id", verifyToken, newMessage);
MessageRoutes.get("/:id", verifyToken, getMessages);
MessageRoutes.delete("/:messageId", verifyToken, deleteMessage);
MessageRoutes.put("/:messageId", verifyToken, editMessage);

export default MessageRoutes;