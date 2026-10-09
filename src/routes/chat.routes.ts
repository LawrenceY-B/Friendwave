import { Router } from "express";
import { validate } from "../middleware/validate";
import { idParams, pageOnly } from "../lib/validation";
import { createChatBody, messageBody } from "../services/chat.service";
import { createChat, deleteChat, getChats } from "../controllers/chats";
import { createMessage, getMessages } from "../controllers/message";

const ChatRoutes = Router();

ChatRoutes.get("/", getChats);
ChatRoutes.post("/", validate({ body: createChatBody }), createChat);
ChatRoutes.delete("/:id", validate({ params: idParams }), deleteChat);
ChatRoutes.get("/:id/messages", validate({ params: idParams, query: pageOnly }), getMessages);
ChatRoutes.post("/:id/messages", validate({ params: idParams, body: messageBody }), createMessage);

export default ChatRoutes;
