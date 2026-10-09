import { Server as SocketIOServer, Socket } from "socket.io";
import { authenticate } from "../services/auth.service";
import { sendMessage } from "../services/chat.service";
import Logger from "../lib/logger";

type Ack = (response: { success: boolean; data?: unknown; message?: string }) => void;

// Clients connect with the same Auth0 access token they use for the REST API:
//   io(API_URL, { auth: { token } })
//
// Client → server:  "message:send" { chatId, text }, ack(response)
// Server → client:  "message:new", "message:updated", "message:deleted"
//                   (the same objects the REST API returns)
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
      Logger.info(`User ${userId} connected: ${socket.id}`);

      socket.on("message:send", async (data, ack?: Ack) => {
        const reply: Ack = typeof ack === "function" ? ack : () => {};
        try {
          const message = await sendMessage(String(data?.chatId), userId, data?.text);
          reply({ success: true, data: message });
        } catch (error: any) {
          if (!error.statusCode) Logger.error(error);
          reply({ success: false, message: error.statusCode ? error.message : "Message not sent" });
        }
      });

      socket.on("disconnect", () => {
        Logger.info(`User ${userId} disconnected: ${socket.id}`);
      });
    });
  }
}
