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
  // An empty list must send nothing: socket.io treats "no rooms" as *everyone*
  if (!io || userIds.length === 0) return;
  io.to(userIds.map(String)).emit(event, payload);
};

// Pub/sub topics for posts: clients subscribe ("posts:watch") to the posts on
// their screen and get live counts and comments for just those posts.
export const postRoom = (postId: string | Types.ObjectId) => `post:${postId}`;

export const emitToPost = (postId: string | Types.ObjectId, event: string, payload: unknown) => {
  if (!io) return;
  io.to(postRoom(postId)).emit(event, payload);
};
