// OpenAPI 3.1 description of the API, served at GET /api/openapi.json.
// The Next.js app can generate TypeScript types from it:
//   npx openapi-typescript http://localhost:4000/api/openapi.json -o src/lib/api-types.ts
// test/api.test.ts checks that every path listed here exists.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const nullable = (schema: object) => ({ oneOf: [schema, { type: "null" }] });

const ok = (data: object, description = "OK") => ({
  description,
  ...json({ type: "object", required: ["success", "data"], properties: { success: { const: true }, data } }),
});
const page = (item: object) => ({
  description: "A page of results, newest first. Pass nextCursor as ?cursor= for the next page.",
  ...json({
    type: "object",
    required: ["success", "data", "nextCursor"],
    properties: {
      success: { const: true },
      data: { type: "array", items: item },
      nextCursor: { type: ["string", "null"] },
    },
  }),
});
const errors = {
  400: { description: "Invalid input", ...json(ref("Error")) },
  401: { description: "Missing, invalid or expired token", ...json(ref("Error")) },
  404: { description: "Not found (or not yours)", ...json(ref("Error")) },
};
const id = (name = "id") => ({ name, in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-f]{24}$" } });
const pageParams = [
  { name: "cursor", in: "query", schema: { type: "string" }, description: "nextCursor from the previous page" },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
];
const textBody = { required: true, ...json({ type: "object", required: ["text"], properties: { text: { type: "string", minLength: 1 } } }) };
const op = (tag: string, summary: string, responses: object, extra: object = {}) => ({
  tags: [tag], summary, ...extra, responses: { ...responses, ...errors },
});

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Friendwave API",
    version: "2.0.0",
    description:
      "Send an Auth0 access token as `Authorization: Bearer <token>`. The first request from a new user creates their account. " +
      "Successful responses are `{ success: true, data }`; errors are `{ success: false, message }`. " +
      "Realtime (socket.io): connect with `io(API_URL, { auth: { token } })`; emit `message:send` { chatId, text } with an ack; " +
      "listen for `message:new`, `message:updated` (Message) and `message:deleted` ({ id, chatId }).",
  },
  servers: [{ url: "http://localhost:4000" }],
  security: [{ bearer: [] }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: {
        type: "object",
        required: ["success", "message"],
        properties: { success: { const: false }, message: { type: "string" } },
      },
      UserSummary: {
        type: "object",
        required: ["id", "username", "name", "avatarUrl"],
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          name: { type: "string" },
          avatarUrl: { type: ["string", "null"] },
        },
      },
      Profile: {
        allOf: [
          ref("UserSummary"),
          {
            type: "object",
            required: ["bio", "followerCount", "followingCount", "postCount", "isMe", "isFollowing"],
            properties: {
              bio: { type: "string" },
              followerCount: { type: "integer" },
              followingCount: { type: "integer" },
              postCount: { type: "integer" },
              isMe: { type: "boolean" },
              isFollowing: { type: "boolean" },
              email: { type: ["string", "null"], description: "Only on your own profile" },
            },
          },
        ],
      },
      Post: {
        type: "object",
        required: ["id", "author", "caption", "images", "likeCount", "likedByMe", "commentCount", "savedByMe", "createdAt"],
        properties: {
          id: { type: "string" },
          author: nullable(ref("UserSummary")),
          caption: { type: "string" },
          images: { type: "array", items: { type: "string" } },
          likeCount: { type: "integer" },
          likedByMe: { type: "boolean" },
          commentCount: { type: "integer" },
          savedByMe: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Reply: {
        type: "object",
        required: ["id", "author", "text", "createdAt"],
        properties: {
          id: { type: "string" },
          author: nullable(ref("UserSummary")),
          text: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Comment: {
        type: "object",
        required: ["id", "postId", "author", "text", "createdAt", "replies"],
        properties: {
          id: { type: "string" },
          postId: { type: "string" },
          author: nullable(ref("UserSummary")),
          text: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          replies: { type: "array", items: ref("Reply") },
        },
      },
      Story: {
        type: "object",
        required: ["id", "post", "createdAt", "expiresAt"],
        properties: {
          id: { type: "string" },
          post: ref("Post"),
          createdAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      StoryGroup: {
        type: "object",
        required: ["author", "stories"],
        properties: { author: ref("UserSummary"), stories: { type: "array", items: ref("Story") } },
      },
      Message: {
        type: "object",
        required: ["id", "chatId", "senderId", "text", "createdAt", "editedAt"],
        properties: {
          id: { type: "string" },
          chatId: { type: "string" },
          senderId: { type: "string" },
          text: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          editedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
      Chat: {
        type: "object",
        required: ["id", "participants", "lastMessage", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" },
          participants: { type: "array", items: ref("UserSummary"), description: "The other people in the chat" },
          lastMessage: nullable(ref("Message")),
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time", description: "Time of the last message" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: { tags: ["System"], summary: "Health check (no auth)", security: [], responses: { 200: { description: "Up" }, 503: { description: "Database down" } } },
    },
    "/api/media/{key}": {
      get: {
        tags: ["System"], summary: "Image (no auth). Redirects to a short-lived S3 link", security: [],
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }],
        responses: { 302: { description: "Redirect to the image" }, 404: { description: "Unknown image" } },
      },
    },
    "/api/feed": {
      get: op("Posts", "Your posts and posts of people you follow", { 200: page(ref("Post")) }, { parameters: pageParams }),
    },
    "/api/users": {
      get: op("Users", "Search users by username or name", { 200: page(ref("UserSummary")) }, {
        parameters: [{ name: "search", in: "query", required: true, schema: { type: "string" } }, ...pageParams],
      }),
    },
    "/api/users/me": {
      get: op("Users", "Your profile", { 200: ok(ref("Profile")) }),
      patch: op("Users", "Update your profile (send only the fields you change)", { 200: ok(ref("Profile")), 409: { description: "Username taken", ...json(ref("Error")) } }, {
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  username: { type: "string", pattern: "^[A-Za-z0-9._]{3,30}$" },
                  bio: { type: "string", maxLength: 150 },
                  avatar: { type: "string", format: "binary", description: "Image, max 5 MB" },
                },
              },
            },
          },
        },
      }),
    },
    "/api/users/me/saved": {
      get: op("Posts", "Posts you saved", { 200: page(ref("Post")) }, { parameters: pageParams }),
    },
    "/api/users/me/followers/{id}": {
      delete: op("Users", "Remove a follower", { 200: ok({ type: "object", properties: { removed: { type: "boolean" } } }) }, { parameters: [id()] }),
    },
    "/api/users/{id}": {
      get: op("Users", "A user's profile", { 200: ok(ref("Profile")) }, { parameters: [id()] }),
    },
    "/api/users/{id}/posts": {
      get: op("Posts", "A user's posts", { 200: page(ref("Post")) }, { parameters: [id(), ...pageParams] }),
    },
    "/api/users/{id}/followers": {
      get: op("Users", "Who follows this user", { 200: page(ref("UserSummary")) }, { parameters: [id(), ...pageParams] }),
    },
    "/api/users/{id}/following": {
      get: op("Users", "Who this user follows", { 200: page(ref("UserSummary")) }, { parameters: [id(), ...pageParams] }),
    },
    "/api/users/{id}/follow": {
      post: op("Users", "Follow (idempotent)", { 200: ok({ type: "object", properties: { following: { const: true }, followerCount: { type: "integer" } } }) }, { parameters: [id()] }),
      delete: op("Users", "Unfollow (idempotent)", { 200: ok({ type: "object", properties: { following: { const: false }, followerCount: { type: "integer" } } }) }, { parameters: [id()] }),
    },
    "/api/posts": {
      post: op("Posts", "Create a post", { 201: ok(ref("Post"), "Created") }, {
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["images"],
                properties: {
                  images: { type: "array", items: { type: "string", format: "binary" }, minItems: 1, maxItems: 10, description: "Images, max 5 MB each" },
                  caption: { type: "string", maxLength: 2200 },
                },
              },
            },
          },
        },
      }),
    },
    "/api/posts/{id}": {
      get: op("Posts", "A post", { 200: ok(ref("Post")) }, { parameters: [id()] }),
      delete: op("Posts", "Delete your post", { 200: ok({ type: "null" }) }, { parameters: [id()] }),
    },
    "/api/posts/{id}/like": {
      post: op("Posts", "Like (idempotent)", { 200: ok({ type: "object", properties: { liked: { const: true }, likeCount: { type: "integer" } } }) }, { parameters: [id()] }),
      delete: op("Posts", "Unlike (idempotent)", { 200: ok({ type: "object", properties: { liked: { const: false }, likeCount: { type: "integer" } } }) }, { parameters: [id()] }),
    },
    "/api/posts/{id}/save": {
      post: op("Posts", "Save (idempotent)", { 200: ok({ type: "object", properties: { saved: { const: true } } }) }, { parameters: [id()] }),
      delete: op("Posts", "Unsave (idempotent)", { 200: ok({ type: "object", properties: { saved: { const: false } } }) }, { parameters: [id()] }),
    },
    "/api/posts/{id}/comments": {
      get: op("Comments", "Comments on a post, newest first", { 200: page(ref("Comment")) }, { parameters: [id(), ...pageParams] }),
      post: op("Comments", "Comment on a post", { 201: ok(ref("Comment"), "Created") }, { parameters: [id()], requestBody: textBody }),
    },
    "/api/comments/{id}": {
      delete: op("Comments", "Delete a comment (its author or the post's owner)", { 200: ok({ type: "null" }), 403: { description: "Not allowed", ...json(ref("Error")) } }, { parameters: [id()] }),
    },
    "/api/comments/{id}/replies": {
      post: op("Comments", "Reply to a comment", { 201: ok(ref("Reply"), "Created") }, { parameters: [id()], requestBody: textBody }),
    },
    "/api/comments/{id}/replies/{replyId}": {
      delete: op("Comments", "Delete a reply (its author or the comment's author)", { 200: ok({ type: "null" }), 403: { description: "Not allowed", ...json(ref("Error")) } }, {
        parameters: [id(), { name: "replyId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
    },
    "/api/stories": {
      get: op("Stories", "Live stories from you and people you follow, grouped by author", { 200: ok({ type: "array", items: ref("StoryGroup") }) }),
      post: op("Stories", "Share a post to your story (24h)", { 201: ok(ref("Story"), "Created") }, {
        requestBody: { required: true, ...json({ type: "object", required: ["postId"], properties: { postId: { type: "string" } } }) },
      }),
    },
    "/api/stories/{id}": {
      delete: op("Stories", "Delete your story", { 200: ok({ type: "null" }) }, { parameters: [id()] }),
    },
    "/api/chats": {
      get: op("Chats", "Your chats, most recently active first", { 200: ok({ type: "array", items: ref("Chat") }) }),
      post: op("Chats", "Open a chat with someone (returns the existing one if any)", { 200: ok(ref("Chat"), "Existing chat"), 201: ok(ref("Chat"), "Created") }, {
        requestBody: { required: true, ...json({ type: "object", required: ["userId"], properties: { userId: { type: "string" } } }) },
      }),
    },
    "/api/chats/{id}": {
      delete: op("Chats", "Delete a chat and its messages", { 200: ok({ type: "null" }) }, { parameters: [id()] }),
    },
    "/api/chats/{id}/messages": {
      get: op("Chats", "Messages, newest first", { 200: page(ref("Message")) }, { parameters: [id(), ...pageParams] }),
      post: op("Chats", "Send a message (also delivered live as message:new)", { 201: ok(ref("Message"), "Created") }, { parameters: [id()], requestBody: textBody }),
    },
    "/api/messages/{id}": {
      patch: op("Chats", "Edit your message", { 200: ok(ref("Message")) }, { parameters: [id()], requestBody: textBody }),
      delete: op("Chats", "Delete your message", { 200: ok({ type: "null" }) }, { parameters: [id()] }),
    },
  },
};
