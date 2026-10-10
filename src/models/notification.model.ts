import { Schema, Types, model } from "mongoose";

export type NotificationType = "follow" | "like" | "comment" | "reply" | "story_share";

export interface INotification {
  userId: Types.ObjectId; // who receives it
  actorId: Types.ObjectId; // who did something
  type: NotificationType;
  postId?: Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["follow", "like", "comment", "reply", "story_share"], required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Posts" },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// Newest first, per recipient
NotificationSchema.index({ userId: 1, _id: -1 });
// Liking or following twice must not notify twice
NotificationSchema.index(
  { userId: 1, actorId: 1, type: 1, postId: 1 },
  { unique: true, partialFilterExpression: { type: { $in: ["like", "follow"] } } }
);
NotificationSchema.index({ postId: 1 });

const Notification = model<INotification>("Notification", NotificationSchema);

export default Notification;
