# Friendwave API (v2)

The source of truth is the OpenAPI spec at **`GET /api/openapi.json`**
(`src/docs/openapi.ts`). The tests fail if a documented route doesn't exist. This page is the
human overview, plus how to consume it from Next.js.

## Conventions

| | |
|---|---|
| Base URL | `http://localhost:4000` locally, your Render URL in production |
| Auth | `Authorization: Bearer <Auth0 access token>` on everything except `/health` and `/api/media/*` ([AUTH.md](AUTH.md)) |
| Success | `{ "success": true, "data": … }` |
| Lists | `{ "success": true, "data": [...], "nextCursor": "…" \| null }`, newest first |
| Errors | `{ "success": false, "message": "…" }` with 400 (bad input), 401 (token), 403 (not allowed), 404 (not found, or not yours), 409 (conflict, e.g. username taken), 429 (rate limited) |
| Ids | every object has `id` (string). Field names are camelCase |
| Pagination | `?limit=` (1–50, default 20) and `?cursor=<nextCursor from the previous page>` |
| Rate limit | 300 requests/minute per IP on `/api` (images and `/health` aren't limited) |

Writes that toggle something (follow, like, save) are **idempotent**: doing them twice is fine and
returns the same result, so a double-click can't break anything.

## Endpoints

**Users**
| | |
|---|---|
| `GET /api/users/me` | your profile (includes `email`) |
| `PATCH /api/users/me` | multipart: `name`, `username`, `bio`, `avatar` (image). Send only what changes. 409 if the username is taken |
| `GET /api/users?search=` | search by username or name |
| `GET /api/users/:id` | a profile: counts, `isFollowing`, `isMe` |
| `GET /api/users/:id/posts` | their posts |
| `GET /api/users/:id/followers` / `following` | user lists |
| `POST` / `DELETE /api/users/:id/follow` | follow / unfollow → `{ following, followerCount }` |
| `DELETE /api/users/me/followers/:id` | remove a follower |
| `GET /api/users/me/saved` | posts you saved |

**Posts**
| | |
|---|---|
| `GET /api/feed` | your posts + people you follow |
| `POST /api/posts` | multipart: `images` (1–10 images, 5 MB each), `caption` |
| `GET` / `DELETE /api/posts/:id` | read / delete (owner only; removes its comments, saves, stories, images) |
| `POST` / `DELETE /api/posts/:id/like` | → `{ liked, likeCount }` |
| `POST` / `DELETE /api/posts/:id/save` | → `{ saved }` |

**Comments**
| | |
|---|---|
| `GET` / `POST /api/posts/:id/comments` | list / add `{ text }` |
| `DELETE /api/comments/:id` | the comment's author or the post's owner |
| `POST /api/comments/:id/replies` | `{ text }` |
| `DELETE /api/comments/:id/replies/:replyId` | the reply's author or the comment's author |

**Stories**
| | |
|---|---|
| `GET /api/stories` | live stories, grouped by author: `[{ author, stories: [{ id, post, createdAt, expiresAt }] }]`, yours first |
| `POST /api/stories` | `{ postId }` → visible for 24h |
| `DELETE /api/stories/:id` | yours only |

**Chats**
| | |
|---|---|
| `GET /api/chats` | `[{ id, participants, lastMessage, updatedAt }]`, most recent first |
| `POST /api/chats` | `{ userId }` → the existing chat (200) or a new one (201) |
| `DELETE /api/chats/:id` | deletes it and its messages |
| `GET` / `POST /api/chats/:id/messages` | history (newest first) / send `{ text }` |
| `PATCH` / `DELETE /api/messages/:id` | edit `{ text }` / delete; your own messages only |

**System**: `GET /health` (no auth) · `GET /api/media/<key>` (images, no auth) · `GET /api/openapi.json`

## Realtime (socket.io)

```ts
import { io } from "socket.io-client";
const socket = io(API_URL, { auth: { token } });       // same Auth0 access token

socket.on("message:new", (message) => {});              // Message
socket.on("message:updated", (message) => {});          // Message
socket.on("message:deleted", ({ id, chatId }) => {});

const res = await socket.emitWithAck("message:send", { chatId, text });  // { success, data | message }
```

Messages sent with REST (`POST /api/chats/:id/messages`) are delivered live too. Events go to
**every** member of the chat, including your other tabs, and including the tab that sent the
message, so de-duplicate by `id`.

## Images

`images[]` and `avatarUrl` are normal URLs (`<API_URL>/api/media/…`). Each one redirects to a
short-lived S3 link, so the bucket stays private and the URL never expires. Avatars from Google or
Gravatar are their own URLs. With `next/image`, either use `unoptimized` for API images or add the API
host, `lh3.googleusercontent.com` and `s.gravatar.com` to `images.remotePatterns`.

## Using it from Next.js

**1. Types from the spec** (rerun whenever the API changes):
```bash
npx openapi-typescript http://localhost:4000/api/openapi.json -o src/lib/api-types.ts
```
```ts
import type { components } from "@/lib/api-types";
type Post = components["schemas"]["Post"];
```

**2. Auth0** with `@auth0/nextjs-auth0` (v4):
- In Auth0, create a **Regular Web Application** for the Next app (it runs on the server and has a
  secret). Allowed Callback URL `http://localhost:3000/auth/callback`, Logout URL `http://localhost:3000`.
  Authorize it on **Friendwave API** (APIs → Friendwave API → Application Access), like the test app.
- `.env.local`: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`
  (`openssl rand -hex 32`), `APP_BASE_URL=http://localhost:3000`, `API_URL=http://localhost:4000`.
```ts
// src/lib/auth0.ts
import { Auth0Client } from "@auth0/nextjs-auth0/server";
export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: "https://api.friendwave",   // = AUTH0_AUDIENCE of the API
    scope: "openid profile email",         // so the API can read new users' profiles
  },
});
```
Add the SDK's middleware (`middleware.ts`, or `proxy.ts` on newer Next.js) as its docs show. That
provides `/auth/login`, `/auth/logout` and `/auth/callback`.

**3. One fetch helper** (server components, server actions, route handlers):
```ts
// src/lib/api.ts
import { auth0 } from "./auth0";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = await auth0.getAccessToken();
  const res = await fetch(`${process.env.API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers },
    cache: "no-store",
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.message);
  return body.data as T;
}

// const feed = await api<Post[]>("/api/feed");
```
For the socket (browser), get a token with the SDK's client-side `getAccessToken()` and pass it to
`io(...)`. Set `CLIENT_ORIGIN=http://localhost:3000` on the API.
