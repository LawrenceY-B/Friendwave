import { Router } from "express";
import upload from "../middleware/upload";
import { validate } from "../middleware/validate";
import { idParams, pageOnly } from "../lib/validation";
import { createChatBody } from "../services/chat.service";
import { createChat, deleteChat, getChat, getChats, getUnreadChats, readChat } from "../controllers/chats";
import { createMessage, getMessages } from "../controllers/message";

const ChatRoutes = Router();

ChatRoutes.get("/", getChats);
ChatRoutes.post("/", validate({ body: createChatBody }), createChat);
ChatRoutes.get("/unread", getUnreadChats); // before /:id
ChatRoutes.post("/:id/read", validate({ params: idParams }), readChat);
ChatRoutes.get("/:id", validate({ params: idParams }), getChat);
ChatRoutes.delete("/:id", validate({ params: idParams }), deleteChat);
ChatRoutes.get("/:id/messages", validate({ params: idParams, query: pageOnly }), getMessages);
// JSON { text }, or multipart with an image (validated in sendMessage, since the body differs)
ChatRoutes.post("/:id/messages", upload.single("image"), validate({ params: idParams }), createMessage);

export default ChatRoutes;
