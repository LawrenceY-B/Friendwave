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

## ⚠️ Changes a client/frontend must make

| What | Before | After |
|---|---|---|
| Login | browser visits `/api/login`, gets the API's own JWT | frontend logs in with an Auth0 SDK and sends the **Auth0 access token** (see [AUTH.md](AUTH.md)) |
| Socket connect | `io(url)` then `emit("addUser", { userId })` | `io(url, { auth: { token } })` with the Auth0 access token; no `addUser` |
| Socket send | `emit("privateMessage", { userId, message })` | `emit("privateMessage", { chatId, message }, ack)` |
| Socket receive | `{ senderSocketId, message }` | the saved Message document (`_id, chatId, senderId, message, …`) |
| `/api/messages/*` `success` | strings `"true"`/`"false"` (**both truthy!**) | booleans |
| Message/chat not found, not yours | 400 | 404 |
| `/api/login`, `/api/logout` | existed | removed; the Auth0 SDK handles both; the first API call creates the account |
| `searchUser`, `getuserprofile` (others) | included `Email`, `Auth0ID` | not included |
| `newpost` | worked with no images (then crashed) | 400 unless at least 1 image |
| Saving an already saved post | hung | 400 `Post already saved` |
| Image URLs | expiring S3 links | `<API_URL>/api/media/...` (stable) |

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
   - Rebuilt every user's Posts/Followers/Followings/SavedPosts/Stories lists from the collections.

   It's safe to run again any time: it does a dry run first, writes a backup, and makes no change when
   nothing is broken.

## Environment variables

Removed: `JWTKEY`, `AUTH0SECRET`, `AUTH0CLIENTID`, `AUTH0BASEURL`.

| Variable | Default | Purpose |
|---|---|---|
| `AUTH0_AUDIENCE` | required | Identifier of the Auth0 API (see [AUTH.md](AUTH.md)) |
| `API_URL` | `http://localhost:<PORT>` | Public URL of this API, used in image links |
| `AUTH0_TEST_CLIENT_ID` / `_SECRET` | none | Dev only, for `npm run token` |
| `AWS_BUCKET` | `fwstorage-trial` | S3 bucket |
| `AWS_REGION` | `eu-west-2` | S3 region |
| `CLIENT_ORIGIN` | `*` | Allowed browser origin for the API and socket.io. Set it to your frontend's URL in production |

## Deploying on Render (later)

- New **Web Service** from the GitHub repo.
- Build command: `npm ci && npm run build`. Start command: `npm start`.
- Add the variables from `.env` in the Render dashboard, **except** the `AUTH0_TEST_*` ones. Render sets
  `PORT` itself. Set `API_URL` to the Render URL, and `CLIENT_ORIGIN` to your frontend's URL.
- `PROD_ENV=Production` turns off debug logs and hides error details.
- Render runs a long-lived server, so socket.io and the cron jobs work there (unlike Vercel's serverless functions).
  On the free plan the service sleeps when idle, and cron jobs don't run while it's asleep.
