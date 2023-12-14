import { Server as SocketIOServer, Socket } from 'socket.io';
import Logger from '../lib/logger';

// Define a type for online users
interface OnlineUsers {
  [userId: string]: Socket;
}

export default class SocketManager {
  private io: SocketIOServer;
  private onlineUsers: OnlineUsers = {};

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketEvents();
    console.log('Socket Manager Initialized');
  }

  private setupSocketEvents(): void {
    // Handle connection event
    this.io.on('connection', (socket: Socket) => {
        socket.emit('test', 'Hello Testing event!');

      this.handleUserConnection(socket);

      // Handle disconnection event
      socket.on('disconnect', () => {
        this.handleUserDisconnection(socket);
      });

  
    });
  }

  handleUserConnection(socket: Socket): void {
    Logger.info(`User connected: ${socket.id}`);
  }

  handleUserDisconnection(socket: Socket): void {
    Logger.info(`User disconnected: ${socket.id}`);
    // Handle user disconnection, remove from onlineUsers if needed
    // const userId = Object.keys(this.onlineUsers).find(
    //   (key) => this.onlineUsers[key].id === socket.id
    // );
    // if (userId) {
    //   delete this.onlineUsers[userId];
    // }
  }



  getIo(): SocketIOServer {
    return this.io;
  }
}

