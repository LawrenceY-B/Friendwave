import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { getMessages, newMessage } from "../controllers/message";

const MessageRoutes = Router();

MessageRoutes.post("/:id", verifyToken, newMessage);
MessageRoutes.get("/:id", verifyToken, getMessages);

export default MessageRoutes;