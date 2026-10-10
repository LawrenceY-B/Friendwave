import { Router } from "express";
import { validate } from "../middleware/validate";
import { pageOnly } from "../lib/validation";
import { getNotifications, getUnreadCount, markAllRead } from "../controllers/notification";

const NotificationRoutes = Router();

NotificationRoutes.get("/", validate({ query: pageOnly }), getNotifications);
NotificationRoutes.get("/unread-count", getUnreadCount);
NotificationRoutes.post("/read", markAllRead);

export default NotificationRoutes;
