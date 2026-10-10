import { Server as SocketIOServer, Socket } from "socket.io";
import { authenticate } from "../services/auth.service";
import { sendMessage } from "../services/chat.service";
import Chat from "../models/conversation.model";
import { emitToUsers, postRoom } from "../lib/realtime";
import Logger from "../lib/logger";

type Ack = (response: { success: boolean; data?: unknown; message?: string }) => void;

const MAX_WATCHED_POSTS = 100;
const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{24}$/.test(value);

// Clients connect with the same Auth0 access token they use for the REST API:
//   io(API_URL, { auth: { token } })
//
// Client → server:
//   "message:send"   { chatId, text }, ack(response)
//   "typing"         { chatId }    you're typing (send every few seconds while you are)
//   "posts:watch"    { postIds }   subscribe to live updates for posts on screen
//   "posts:unwatch"  { postIds }
//   "presence:query" { userIds }, ack({ success, data: { [userId]: online } })  chat partners only
// Server → client:
//   "message:new" | "message:updated" | "message:deleted"
//   "post:counts" { postId, likeCount, commentCount }
//   "comment:new" | "comment:deleted" | "reply:new" | "reply:deleted"
//   "feed:new-post" { postId, authorId }      to followers of the author
//   "notification:new" Notification
//   "presence:update" { userId, online }      to people you share a chat with
//   "chat:read" { chatId }                     to yourself (other tabs/devices) when you read a chat
//   "typing" { chatId, userId }                to the other people in the chat
export default class SocketManager {
  constructor(private io: SocketIOServer) {
    this.setupAuth();
    this.setupSocketEvents();
  }

  // Runs once per connection, before "connection". Rejecting here means
  // nobody can connect (or claim to be another user) without a valid token.
  private setupAuth(): void {
    this.io.use(async (socket, next) => {
      try {
        const user = await authenticate(String(socket.handshake.auth?.token));
        socket.data.userId = user.userID;
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    });
  }

  private setupSocketEvents(): void {
    this.io.on("connection", (socket: Socket) => {
      const userId: string = socket.data.userId;
      // Every socket of a user (phone, laptop, extra tabs) joins a room named
      // after the user id, so a message to that room reaches all of them.
      socket.join(userId);
      socket.data.watching = new Set<string>();
      Logger.info(`User ${userId} connected: ${socket.id}`);

      // First tab/device to connect → this user just came online
      if (this.socketCount(userId) === 1) this.announcePresence(userId, true);

      socket.on("message:send", async (data, ack?: Ack) => {
        const reply = this.ackOf(ack);
        try {
          const message = await sendMessage(String(data?.chatId), userId, data?.text);
          reply({ success: true, data: message });
        } catch (error: any) {
          if (!error.statusCode) Logger.error(error);
          reply({ success: false, message: error.statusCode ? error.message : "Message not sent" });
        }
      });

      // Typing: members only (checked once per chat, then remembered), at most once a second
      const typingChats = new Map<string, { members: string[]; last: number }>();
      socket.on("typing", async (data) => {
        const chatId = String(data?.chatId ?? "");
        if (!/^[0-9a-f]{24}$/.test(chatId)) return;
        let entry = typingChats.get(chatId);
        if (!entry) {
          const chat = await Chat.findOne({ _id: chatId, members: userId }).select("members").lean();
          if (!chat) return; // not your chat: ignore quietly
          entry = { members: chat.members.map(String), last: 0 };
          typingChats.set(chatId, entry);
        }
        const now = Date.now();
        if (now - entry.last < 1000) return;
        entry.last = now;
        emitToUsers(entry.members.filter((m) => m !== userId), "typing", { chatId, userId });
      });

      socket.on("posts:watch", (data) => {
        const watching: Set<string> = socket.data.watching;
        for (const postId of this.idList(data?.postIds)) {
          if (watching.size >= MAX_WATCHED_POSTS) break;
          watching.add(postId);
          socket.join(postRoom(postId));
        }
      });

      socket.on("posts:unwatch", (data) => {
        const watching: Set<string> = socket.data.watching;
        for (const postId of this.idList(data?.postIds)) {
          watching.delete(postId);
          socket.leave(postRoom(postId));
        }
      });

      socket.on("presence:query", async (data, ack?: Ack) => {
        const reply = this.ackOf(ack);
        try {
          // Only people you share a chat with: presence isn't public
          const partners = new Set(await this.chatPartners(userId));
          const result: Record<string, boolean> = {};
          for (const id of this.idList(data?.userIds)) {
            if (partners.has(id)) result[id] = this.socketCount(id) > 0;
          }
          reply({ success: true, data: result });
        } catch (error) {
          Logger.error(error);
          reply({ success: false, message: "Couldn't check who's online" });
        }
      });

      socket.on("disconnect", () => {
        Logger.info(`User ${userId} disconnected: ${socket.id}`);
        // Last tab/device closed → offline (the socket has already left its rooms here)
        if (this.socketCount(userId) === 0) this.announcePresence(userId, false);
      });
    });
  }

  private socketCount(userId: string): number {
    return this.io.sockets.adapter.rooms.get(userId)?.size ?? 0;
  }

  isOnline(userId: string): boolean {
    return this.socketCount(userId) > 0;
  }

  private async chatPartners(userId: string): Promise<string[]> {
    const chats = await Chat.find({ members: userId }).select("members").lean();
    return [...new Set(chats.flatMap((chat) => chat.members.map(String)))].filter((id) => id !== userId);
  }

  private announcePresence(userId: string, online: boolean) {
    this.chatPartners(userId)
      .then((partners) => emitToUsers(partners, "presence:update", { userId, online }))
      .catch((error) => Logger.error(error));
  }

  private idList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter(isId).slice(0, MAX_WATCHED_POSTS) : [];
  }

  private ackOf(ack?: Ack): Ack {
    return typeof ack === "function" ? ack : () => {};
  }
}
