# Code review notes (October 2026)

These notes cover what changed when the project was upgraded and fixed after two years untouched,
and **why** each change was needed. Each section is one lesson, with a "before" snippet from this
codebase and the fix. Check `git log -p` for the full diffs.

---

## 1. Sending a response doesn't stop your function: `return` it

This was the most common bug. `res.status(...).json(...)` sends a response, but the
function **keeps running**. The code below it then tries to send a second response
(`ERR_HTTP_HEADERS_SENT`), or crashes on data that isn't there.

```ts
// before: middleware/isAuthorized.ts
if (!Authorization || !Authorization.startsWith("Bearer ")) {
  res.status(401).json({ message: "Invalid Authorization header" });
}
const token = Authorization!.split(" ")[1]; // 💥 runs anyway; Authorization is undefined
```

```ts
// after
if (!Authorization || !Authorization.startsWith("Bearer ")) {
  return res.status(401).json({ success: false, message: "Invalid Authorization header" });
}
```

The same pattern appeared in most controllers: validation errors (`if (error) res.status(400)...`
followed by the normal path), `if (!post) res.status(404)...`, and so on.

A related trap: **checking for "not found" after responding.**

```ts
// before: getUser
res.status(200).json({ success: true, userData });
if (!userData) res.status(404).json(...); // too late, and find() returns [] (never null)
```

**Rule of thumb:** every `res.…json()` inside an `if` should be `return res.…json()`.
Also, the `!` in `Authorization!` tells TypeScript "trust me, it's not undefined". If you
need it, ask yourself why the compiler thinks it might be.

## 2. Every code path must send exactly one response

Bugs in the opposite direction: some paths sent **nothing**, so the client waited until it timed out.

```ts
// before: AddtoSaved
if (!isSaved) {
  ...
  res.status(200).json({ success: true, message: "Post saved successfully" });
}
// already saved? → no response at all, the request hangs
```

```ts
// before: newChat
} catch (error) {}   // the error is swallowed AND the request hangs
```

Never leave a `catch` empty. In a controller it should almost always be `next(error)`.

## 3. Helpers throw; controllers decide the response

```ts
// before: services/post.service.ts
export const ImageUpload = async (images, next, userid) => {
  try { ... } catch (err) { next(err); }   // sends the error response...
};
// ...then the controller carries on and sends "Post created" → two responses
```

A helper that receives `next` can respond behind the controller's back. Now
`lib/s3.ts#uploadImage` just **throws**. The controller's own `try/catch` passes the error to
`next(error)` once, and the error handler sends one response.

Also, the old code created a **new S3 client on every upload**. Create it once per module and reuse it.

## 4. `await` your database calls

```ts
// before: controllers/message.ts
let isSaved = sendMessage.save();  // a Promise, not a result
if (!isSaved) { ... }              // a Promise is always truthy → never runs
```

Without `await`, the response goes out before the write finishes, and if the write fails
nobody finds out. The same happened with `isExisting?.save()`, `updateUser?.save()` and `comment.save()`.

## 5. Never trust IDs from the client: check ownership

Being **logged in** (authentication) is not the same as being **allowed** to do something
(authorization). Before the fix, any logged-in user could:

- read and post messages in **any** chat by guessing its id,
- edit or delete **anyone's** messages,
- delete **any** chat or comment, and any reply.

The fix is to include the owner in the query itself, so a stranger's request simply finds nothing:

```ts
// before
await Message.findByIdAndDelete(messageId);
// after: only matches if you sent it
await Message.findOneAndDelete({ _id: messageId, senderId: req.user.userID });
```

Chat membership is checked in one place (`services/chat.service.ts#findChatForMember`), and both
the REST endpoints and the socket use it.

The same idea applies to the socket: it used to trust `socket.on("addUser", { userId })`, so anyone
could claim to be any user and receive their messages. Now the access token is verified when the socket
connects (`io.use(...)`), and the user id comes from the token.

## 6. Don't return private fields of *other* users

`searchUser` and `getuserprofile` returned other people's **email and Auth0 id**. Only your own
profile (`getUser`) includes your email now. Decide what's public per endpoint; the default
should be "nothing".

## 7. Atomic updates instead of read → modify → save

```ts
// before: addLikes
const post = await Post.findOne({ postId });
if (post.likes.includes(userID)) ...   // ← also a bug, see below
post.likes.push(userID);
post.save();
```

There were two problems here:

1. **The check never matched.** `likes` holds `ObjectId` objects and `userID` is a string.
   `.includes()` compares by identity, so the result was always `false`. Users could like a post many
   times, and "unlike" always replied "You have not liked this post". (TypeScript 7's stricter
   Mongoose types caught this during the upgrade.) To compare ObjectIds, use `id.equals(other)`.
2. **Race condition.** If two likes arrive at the same moment, both read the old array and both
   save, so one like is lost.

```ts
// after: MongoDB does the check-and-add in one step
const result = await Post.updateOne({ postId }, { $addToSet: { likes: userID } });
if (result.matchedCount === 0) → 404 post not found
if (result.modifiedCount === 0) → 400 already liked
```

`$addToSet` / `$pull` are now used for likes, saved posts, followers, stories and comments.

## 8. Keep duplicated data in sync, or don't duplicate it

The app stores follows twice: in the `Following`/`Follower` collections **and** in each user's
`Followings`/`Followers` arrays. `removeFollow` deleted the documents but never updated the arrays,
so the counts drifted. Every write now updates both places. Likewise, deleting a post now also removes
its comments, saves, stories and S3 images.

If you ever redesign this, pick **one** source of truth (the collections) and compute the arrays with queries.

## 9. Validate input shape *and* format

The Joi schemas had no `.required()`, so `{}` passed validation and the code then queried
`postId: undefined`. IDs also weren't checked, so `"abc"` caused a Mongoose `CastError` → **500**.

```ts
// lib/validation.ts
export const objectId = () => joi.string().hex().length(24);
// services/post.service.ts
postID: objectId().required(),
```

The validators were also typed `(caption: Request)`, but they receive `req.body`, not the request.
They're now typed `unknown`.

## 10. Escape user input before putting it in a RegExp

```ts
// before
new RegExp(username, "i")   // username = "(a+)+$" → catastrophic backtracking (ReDoS)
// after
new RegExp(escapeRegex(username), "i")
```

The search also returns at most 20 results now.

## 11. Order of middleware matters

- **Authentication before reading uploads.** `upload.array('images', 10)` ran *before* `verifyToken`,
  so anyone without an account could make the server load up to 10 files into memory. `verifyToken`
  now runs first, and multer has limits: images only, 5 MB each, 10 files max (`middleware/upload.ts`).
- **The request logger (morgan) was registered after the routes and the 404 handler.** Requests never reached it,
  so it never logged anything. Loggers go first, error handlers go last.

## 12. `try/catch` doesn't cover code that runs later

```ts
// before: jobs/story.jobs.ts
try {
  cron.schedule("...", async () => { await User.find() ... });  // runs an hour later
} catch (error) { ... }   // this try/catch finished long ago, so it never catches anything from the callback
```

The `try/catch` belongs **inside** the callback. The same goes for `setTimeout`, event handlers
and `.map(async ...)`. The story cleanup is now a single `updateMany` with `$pull`, instead of
nested un-awaited loops.

## 13. Read cron expressions carefully

`"* */24 * * *"` means *every minute* during hour 0, so the log was cleared **60 times** at midnight.
"Once a day at midnight" is `"0 0 * * *"`. https://crontab.guru is handy for checking.

## 14. TTL index semantics

```ts
expireAt: { type: Date, default: () => Date.now() + 24h, expires: 60 * 60 * 24 }
```

`expires` means "delete N seconds **after** the date in this field". The date was already 24h in the
future, so stories lived **48h**. It's now `expires: 0`.

## 15. Pre-signed URLs expire

`getSignedUrl()` returns a link that works for **15 minutes** by default. That link was saved as the
post's permanent `imageUrl`, so every image broke after 15 minutes.

Now the database stores the **S3 key** (`posts/<user>/<uuid>.jpeg`). A Mongoose getter turns it into
`<API_URL>/api/media/<key>`, and that route redirects to a fresh signed URL
(`routes/media.routes.ts`). The bucket stays private.

Two upload bugs were also fixed. Keys used `Date.now()`, so several images uploaded in the same millisecond
**overwrote each other**; they now use a random UUID. `ContentType` is also set now, so browsers display the
image instead of downloading it.

## 16. Fail fast on configuration

```ts
// before
DBUrl: String(process.env.MONGODBURL)   // missing → the *string* "undefined"
const env = `${environment.PROD_ENV}` || "Development"  // "undefined" is truthy → fallback never used
```

There were also three different checks for "is this development?". The logger used `"Development"` and the
error handler used `"development"`, so stack traces were **never** shown, not even in development.
`environments/endpoints.config.ts` now throws at startup if a required variable is missing, and exports
one `isDevelopment` flag.

The server also used to start listening *before* the database connected, and a failed connection was only logged.
Now it connects first and exits if the connection fails, so Render will show the failure clearly.

## 17. Let the identity provider own login (switched to Auth0 access tokens)

The old flow was `/api/login`: the browser was sent to Auth0, came back to the API, and the API then
signed **its own** JWT with `JWTKEY` and showed it as a JSON page. That had three problems:

- A separate frontend (React, mobile) had no clean way to read a token shown on the API's own domain.
- The API had to guard two extra secrets (`JWTKEY`, `AUTH0SECRET`). When they leaked, it had to rotate them.
- Logout couldn't work. The old `Logout` signed a new token with `exp: 0`, which does nothing to the
  real token (valid for 7 days), and it also responded twice.

Now the frontend logs in with Auth0 directly, and the API only **verifies** Auth0's access tokens with
Auth0's public keys (RS256). The API holds no signing secret at all. New users are created
automatically on their first request. See [AUTH.md](AUTH.md) for how it works and how to test it.

Lesson: don't build your own token system on top of an identity provider unless you need to.

## 18. Enforce uniqueness in the database, not just in code

Checking "is this username free?" and then inserting leaves a gap: two signups at the same moment
can both pass the check. A **unique index** makes MongoDB itself refuse the second one. The code
catches that error (`E11000`) and retries with another name. The index uses a case-insensitive
*collation*, so `Lawrence` and `lawrence` count as the same. The same idea protects `Auth0ID`
(one account per Auth0 user).

## 19. Smaller things

- Unknown errors now return 400 instead of 500 when they're the client's fault (bad id, bad JSON,
  upload too large). Internal error messages are hidden outside development, and the logger now
  prints stack traces.
- `deletePost` returned "deleted successfully" even when you weren't the owner and nothing was deleted.
- `getPost` existed but was never routed: it's now `GET /api/posts/:postId`.
- Express 5 (new since the upgrade) forwards errors from `async` handlers to the error handler by itself.
  The `try/catch` + `next(error)` blocks still work, but new code can skip them.

---

# Part 2: API v2, preparing for a frontend

Every route and response was redesigned before any frontend existed (the cheapest time to do it).
The full reference is [API.md](API.md). The lessons:

## 20. Use HTTP the way it's meant: resources + methods

Before: `POST /api/posts/allcomments` (a read sent as POST), `DELETE /api/posts/removecomment` with
the id in a JSON body, and names like `/addFollowing`, `/getuserprofile`. After: the URL names the
**thing**, and the method says what to do with it:

```
GET    /api/posts/:id/comments      read
POST   /api/posts/:id/comments      create
DELETE /api/comments/:id            delete
POST   /api/users/:id/follow        follow      DELETE same URL → unfollow
```

Reads that use GET can be cached, retried and opened in a browser. Ids in the URL can be validated by
the route, and every client library expects this shape.

## 21. One response shape everywhere

Before: `userData: [user]` (an array for one user), `post`, `comments`, `chat`, `data`,
`status: true` instead of `success`, and `"true"` as a string. After: always `{ success, data }`, plus
`nextCursor` for lists, and errors are always `{ success: false, message }`. The frontend needs **one**
fetch helper.

## 22. A DTO layer between the database and the API

`lib/dto.ts` turns database documents into API objects. Field names become camelCase, `_id` becomes
`id`, S3 keys become URLs, the author is embedded, and counts and "liked by me" are added. The database
kept its PascalCase field names. **Your storage format and your API are separate contracts**: you can
change one without breaking the other.

## 23. Paginate with a cursor, and avoid N+1 queries

- Lists used to return *everything*. Now they return 20 at a time, plus a `nextCursor` (the id of the
  last item). The next page is "items older than that id". Unlike `?page=2` (skip/offset), new posts
  arriving don't shift the pages, so you never see duplicates or miss items.
- Showing 20 posts with "comment count" and "saved by me" could take 40 extra queries, two per
  post: the **N+1 problem**. `buildPosts` fetches them for the whole page in **2** queries
  (`services/post.service.ts`). The same goes for chat participants and last messages.

## 24. One source of truth (follow-up to lesson 8)

The user arrays (`Followers`, `Posts`, `SavedPosts`…) and the mirror `followers` collection are
gone (`scripts/migrate-v2.mjs`). Counts are computed from the real collections, so they **can't** drift.
Unique indexes guarantee "follow once" and "save once" at the database level.

## 25. Idempotent writes

`POST /users/:id/follow` twice = still following, `200` both times. The same goes for like and save.
Double-clicks, retries and two open tabs can't cause errors or duplicates. (The old API answered the
second request with "already liked"/"already saved" errors that the UI had to special-case.)

## 26. Throw errors, don't hand-write every response

Express 5 sends errors thrown in async handlers to the error handler automatically. Controllers now
`throw notFound("Post")` (`lib/http.ts`) instead of writing `return res.status(404).json(...)` by hand,
which also makes lesson 1's "forgot the `return`" bug impossible. Validation moved into the routes:
`validate({ params, query, body })` runs before the controller.

## 27. Tests that can fail

`npm test` runs 36 tests against the real app, in-process, with an in-memory MongoDB, a fake Auth0
and a fake S3 (`test/helpers.ts`). To check that the tests aren't just passing, two bugs were planted on
purpose: a missing route, and a missing "is it your message?" check. Both were caught. A test you've never
seen fail isn't proof of anything.

## 28. Production basics

- `GET /health` lets Render check that the app (and its database) is up.
- **Graceful shutdown:** on SIGTERM (sent by Render during a deploy), the server stops accepting connections,
  finishes running requests, closes the database, then exits. Requests aren't cut off mid-way.
- `helmet` security headers, with `Cross-Origin-Resource-Policy: cross-origin` so the frontend can
  still load images.
- Rate limiting (300/min per IP), with `trust proxy` so Render's proxy doesn't make everyone share one IP.
- The OpenAPI spec is the contract with the frontend, and a test fails if a documented route is missing.

## One-off database steps

1. **Story TTL index.** MongoDB won't change an existing index's options, so it had to be dropped
   and recreated once (✅ done on the real database on 2026-10-09):
   ```js
   // mongosh
   db.stories.dropIndex("expireAt_1")
   db.stories.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
   ```
2. **Old data repaired** (✅ done on 2026-10-09 with `scripts/cleanup-data.mjs`). The script:
   - Copied the old images to clean S3 keys with the correct content type, and stored the keys,
     so the expired links now work again through `/api/media/…`.
   - Moved a conversation that had been saved in the wrong chat.
   - Removed likes and comment ids pointing at deleted things.

   It's safe to run again any time: it does a dry run first, writes a backup, and makes no change when
   nothing is broken.
3. **v2 data model** (✅ done on 2026-10-09 with `scripts/migrate-v2.mjs`): removed the duplicated user
   arrays and post fields, folded `followers` into `followings`, and set each chat's `updatedAt` to its
   last message. The 5 old leading-slash S3 copies were deleted after verifying the new ones.

## Environment variables

Removed: `JWTKEY`, `AUTH0SECRET`, `AUTH0CLIENTID`, `AUTH0BASEURL`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | So it doesn't clash with Next.js on 3000 |
| `AUTH0_AUDIENCE` | required | Identifier of the Auth0 API (see [AUTH.md](AUTH.md)) |
| `API_URL` | `http://localhost:<PORT>` | Public URL of this API, used in image links |
| `AUTH0_TEST_CLIENT_ID` / `_SECRET` | none | Dev only, for `npm run token` |
| `AWS_BUCKET` | `fwstorage-trial` | S3 bucket |
| `AWS_REGION` | `eu-west-2` | S3 region |
| `CLIENT_ORIGIN` | `*` | Allowed browser origin for the API and socket.io. Set it to your frontend's URL in production |
| `RATE_LIMIT_PER_MINUTE` | `300` | Requests per minute per IP on `/api` |
| `AUTH0_MGMT_CLIENT_ID` / `_SECRET` | none | Only for `scripts/link-accounts.mjs` |

## Deploying on Render

1. The region in `render.yaml` is `virginia`, next to the Atlas cluster (AWS us-east-1) and the Vercel functions (`iad1`).
2. Render Dashboard → **New → Blueprint** → this repo. It reads `render.yaml` (build `npm ci && npm run build`,
   start `npm start`, health check `/health`, Node 22, `PROD_ENV=Production`) and asks for the secrets:
   `MONGODBURL`, `ISSUERBASEURL`, `AUTH0_AUDIENCE`, `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`,
   `API_URL` (this service's own `https://….onrender.com` URL) and `CLIENT_ORIGIN` (your Vercel URL).
   Don't add `AUTH0_TEST_*` / `AUTH0_MGMT_*` (local scripts only) or `PORT` (Render sets it).
3. **MongoDB Atlas → Network Access:** allow Render's outbound IPs (listed in the service's settings), or `0.0.0.0/0`.
4. Check `https://….onrender.com/health` returns `{"status":"ok","db":true}`.

Notes:
- `NODE_ENV` is deliberately not set to `production` during the build, because `npm ci` would then skip
  TypeScript (a devDependency), which the build needs.
- Render runs a long-lived server, so socket.io (live chat) works there, unlike Vercel's serverless functions.
- **Free plan:** the service sleeps after ~15 min idle. The first request then waits ~1 min (the frontend shows
  "API offline" meanwhile), live chat sockets drop, and the daily log cleanup doesn't run. `plan: starter` stays awake.
