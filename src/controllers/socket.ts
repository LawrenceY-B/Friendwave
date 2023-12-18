import { Server as SocketIOServer, Socket } from "socket.io";
import Logger from "../lib/logger";

export default class SocketManager {
  private io: SocketIOServer;
  private onlineUsers: Map<string, string> = new Map<string, string>();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketEvents();
  }

  private setupSocketEvents(): void {
    this.io.on("connection", (socket: Socket) => {
      this.handleUserConnection(socket);

      socket.on("disconnect", () => {
        this.handleUserDisconnection(socket);
      });

      socket.on("privateMessage", (data) => {
        this.handlePrivateMessage(socket, data);
      });
    });
  }

  handleUserConnection(socket: Socket): void {
    Logger.info(`User connected: ${socket.id}`);
    socket.on("addUser", (userID) => {
      const {userId} = userID;
      Logger.info(`Received addUser event for userID: ${userId}`);
      const isExisting = this.onlineUsers.has(userId);
      
      if (!isExisting) {
        this.onlineUsers.set(userId, socket.id);;
      }
      
     Logger.debug(this.onlineUsers);
    });
  }
  

  handlePrivateMessage(
    socket: Socket,
    data: { userId: string; message: string }
  ): void {
    const { userId, message } = data;
    const targetSocketId = this.onlineUsers.get(userId) as string;
    Logger.info(
      `Received privateMessage event from ${socket.id} to ${targetSocketId}`
    );
    socket.to(targetSocketId).emit("privateMessage", {
      senderSocketId: socket.id,
      message: message,
    });

    // socket.emit("privateMessage", {
    //   receiverSocketId: targetSocketId,
    //   message: message,
    // });
  }
  handleUserDisconnection(socket: Socket): void {
    Logger.info(`User disconnected: ${socket.id}`);
    this.onlineUsers.forEach((value, key) => {
      if (value === socket.id) {
        this.onlineUsers.delete(key);
      }
    })
  }

}
