import { Server as SocketIOServer } from "socket.io";
import { Types } from "mongoose";

// Lets REST controllers push live events without importing the socket setup.
// Every socket joins a room named after its user id (see controllers/socket.ts).
let io: SocketIOServer | null = null;

export const setRealtimeServer = (server: SocketIOServer | null) => {
  io = server;
};

export const emitToUsers = (
  userIds: (string | Types.ObjectId)[],
  event: string,
  payload: unknown
) => {
  if (!io) return;
  io.to(userIds.map(String)).emit(event, payload);
};
