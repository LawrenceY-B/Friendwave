import { Server as SocketIOServer, Socket } from "socket.io";
import { authenticate } from "../services/auth.service";
import Message from "../models/message.model";
import { findChatForMember, validateMessage } from "../services/chat.service";
import Logger from "../lib/logger";

type Ack = (response: { success: boolean; message: string; data?: unknown }) => void;

// Clients connect with the same Auth0 access token they use for the REST API:
//   io(API_URL, { auth: { token } })
export default class SocketManager {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
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
      Logger.info(`User ${userId} connected: ${socket.id}`);

      socket.on("privateMessage", (data, ack?: Ack) => {
        this.handlePrivateMessage(socket, data, ack);
      });

      socket.on("disconnect", () => {
        Logger.info(`User ${userId} disconnected: ${socket.id}`);
      });
    });
  }

  isOnline(userId: string): boolean {
    return (this.io.sockets.adapter.rooms.get(userId)?.size ?? 0) > 0;
  }

  // data: { chatId, message }. Saves the message, then delivers it live to
  // the other members of the chat.
  async handlePrivateMessage(
    socket: Socket,
    data: { chatId: string; message: string },
    ack?: Ack
  ): Promise<void> {
    const reply: Ack = typeof ack === "function" ? ack : () => {};
    try {
      const senderId: string = socket.data.userId;
      const { error } = validateMessage({ message: data?.message });
      if (error) return reply({ success: false, message: error.message });

      const chat = await findChatForMember(String(data.chatId), senderId);
      if (!chat) return reply({ success: false, message: "Chat not found" });

      const saved = await Message.create({
        chatId: chat._id,
        senderId,
        message: data.message,
        dateTime: Date.now(),
      });

      for (const member of chat.members) {
        if (String(member) !== senderId) {
          this.io.to(String(member)).emit("privateMessage", saved);
        }
      }
      reply({ success: true, message: "Message Sent", data: saved });
    } catch (error) {
      Logger.error(error);
      reply({ success: false, message: "Message not sent" });
    }
  }
}
