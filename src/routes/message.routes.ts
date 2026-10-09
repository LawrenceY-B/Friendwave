import { Router } from "express";
import { validate } from "../middleware/validate";
import { idParams } from "../lib/validation";
import { messageBody } from "../services/chat.service";
import { deleteMessage, editMessage } from "../controllers/message";

const MessageRoutes = Router();

MessageRoutes.patch("/:id", validate({ params: idParams, body: messageBody }), editMessage);
MessageRoutes.delete("/:id", validate({ params: idParams }), deleteMessage);

export default MessageRoutes;
