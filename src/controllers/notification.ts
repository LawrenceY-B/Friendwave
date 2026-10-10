import { Request, Response } from "express";
import Notification from "../models/notification.model";
import { pageFrom, paginate, send, sendPage } from "../lib/http";
import { buildNotifications } from "../services/notification.service";

// GET /notifications. Newest first.
export const getNotifications = async (req: Request, res: Response) => {
  const { items, nextCursor } = await paginate(
    (filter) => Notification.find(filter).lean(),
    { userId: req.user.userID },
    pageFrom(req)
  );
  sendPage(res, await buildNotifications(items), nextCursor);
};

// GET /notifications/unread-count (for the red dot on the bell)
export const getUnreadCount = async (req: Request, res: Response) => {
  send(res, { count: await Notification.countDocuments({ userId: req.user.userID, read: false }) });
};

// POST /notifications/read. Marks everything read (opening the notifications page).
export const markAllRead = async (req: Request, res: Response) => {
  const result = await Notification.updateMany({ userId: req.user.userID, read: false }, { $set: { read: true } });
  send(res, { updated: result.modifiedCount });
};
