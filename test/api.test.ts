import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { imageForm, nextEvent, startTestServer, TestServer } from "./helpers";

let t: TestServer;
type User = Awaited<ReturnType<TestServer["login"]>>;
let alice: User, bob: User, carol: User;

before(async () => {
  t = await startTestServer();
  alice = await t.login("auth0|alice", { nickname: "alice", name: "Alice A", email: "alice@test.io", picture: "https://pics.test/alice.png" });
  bob = await t.login("auth0|bob", { nickname: "bob", name: "Bob B", email: "bob@test.io" });
  carol = await t.login("auth0|carol", { nickname: "carol", name: "Carol C" });
});
after(() => t.stop());

describe("auth", () => {
  it("rejects requests without a token", async () => {
    const res = await t.request("GET", "/api/users/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it("rejects bad tokens", async () => {
    const bad = {
      "wrong audience": await t.sign("auth0|alice", { aud: "https://other-api" }),
      "wrong issuer": await t.sign("auth0|alice", { iss: "https://evil.auth0.com/" }),
      "unknown key": await t.sign("auth0|alice", { useOtherKey: true }),
      expired: await t.sign("auth0|alice", { exp: Math.floor(Date.now() / 1000) - 60 }),
      garbage: "not.a.token",
    };
    for (const [name, token] of Object.entries(bad)) {
      assert.equal((await t.request("GET", "/api/users/me", token)).status, 401, name);
    }
  });

  it("creates a new user on their first request, once, even with simultaneous requests", async () => {
    t.profiles.set("google-oauth2|dave", { nickname: "dave", name: "Dave", email: "dave@test.io" });
    const token = await t.sign("google-oauth2|dave");
    const results = await Promise.all([1, 2, 3].map(() => t.request("GET", "/api/users/me", token)));
    assert.ok(results.every((r) => r.status === 200));
    assert.equal(new Set(results.map((r) => r.body.data.id)).size, 1);
    assert.equal(results[0].body.data.username, "dave");
    assert.equal(results[0].body.data.email, "dave@test.io");
  });

  it("handles users without a name or email (Apple)", async () => {
    const first = await t.login("apple|001");
    const second = await t.login("apple|002");
    assert.match((await first.get("/api/users/me")).body.data.username, /^user/);
    assert.notEqual((await first.get("/api/users/me")).body.data.username, (await second.get("/api/users/me")).body.data.username);
  });

  it("gives clashing nicknames a numbered username, case-insensitively", async () => {
    const other = await t.login("google-oauth2|alice2", { nickname: "ALICE" });
    assert.match((await other.get("/api/users/me")).body.data.username, /^ALICE\d{4}$/);
    const sams = await Promise.all([1, 2, 3, 4].map((n) => t.login(`google-oauth2|sam${n}`, { nickname: "sam" })));
    const names = await Promise.all(sams.map(async (s) => (await s.get("/api/users/me")).body.data.username.toLowerCase()));
    assert.equal(new Set(names).size, 4);
  });
});

describe("users", () => {
  it("returns your own profile with email", async () => {
    const res = await alice.get("/api/users/me");
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
    assert.equal(res.body.data.username, "alice");
    assert.equal(res.body.data.avatarUrl, "https://pics.test/alice.png");
    assert.equal(res.body.data.email, "alice@test.io");
    assert.equal(res.body.data.isMe, true);
  });

  it("hides email on other people's profiles", async () => {
    const res = await bob.get(`/api/users/${alice.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, undefined);
    assert.equal(res.body.data.isMe, false);
  });

  it("404s for unknown users and 400s for malformed ids", async () => {
    assert.equal((await alice.get("/api/users/aaaaaaaaaaaaaaaaaaaaaaaa")).status, 404);
    assert.equal((await alice.get("/api/users/nope")).status, 400);
  });

  it("searches users, treating regex characters literally", async () => {
    const res = await alice.get("/api/users?search=bo");
    assert.ok(res.body.data.some((u: any) => u.username === "bob"));
    assert.equal(res.body.data[0].email, undefined);
    assert.deepEqual((await alice.get(`/api/users?search=${encodeURIComponent("(a+)+$")}`)).body.data, []);
    assert.equal((await alice.get("/api/users")).status, 400);
  });

  it("updates the profile and enforces unique usernames", async () => {
    assert.equal((await alice.patch("/api/users/me", { username: "BOB" })).status, 409);
    assert.equal((await alice.patch("/api/users/me", { username: "bad name!" })).status, 400);
    const res = await alice.patch("/api/users/me", { username: "Alice", bio: "hello" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.username, "Alice");
    assert.equal(res.body.data.bio, "hello");
  });

  it("uploads an avatar", async () => {
    const form = new FormData();
    form.append("avatar", new Blob(["x"], { type: "image/png" }), "me.png");
    const res = await carol.patch("/api/users/me", form);
    assert.equal(res.status, 200);
    assert.match(res.body.data.avatarUrl, /^http:\/\/api\.test\/api\/media\/profile\//);
  });

  it("follows and unfollows idempotently", async () => {
    assert.equal((await alice.post(`/api/users/${bob.id}/follow`)).body.data.followerCount, 1);
    assert.equal((await alice.post(`/api/users/${bob.id}/follow`)).body.data.followerCount, 1);
    assert.equal((await bob.get(`/api/users/${bob.id}/followers`)).body.data[0].username, "Alice");
    assert.equal((await alice.get(`/api/users/${alice.id}/following`)).body.data.length, 1);
    assert.equal((await alice.get(`/api/users/${bob.id}`)).body.data.isFollowing, true);
    assert.equal((await alice.del(`/api/users/${bob.id}/follow`)).body.data.followerCount, 0);
    assert.equal((await alice.post(`/api/users/${alice.id}/follow`)).status, 400);
    assert.equal((await alice.post("/api/users/aaaaaaaaaaaaaaaaaaaaaaaa/follow")).status, 404);
  });

  it("removes a follower", async () => {
    await carol.post(`/api/users/${bob.id}/follow`);
    assert.equal((await bob.del(`/api/users/me/followers/${carol.id}`)).body.data.removed, true);
    assert.equal((await bob.get(`/api/users/${bob.id}`)).body.data.followerCount, 0);
  });
});

describe("posts and feed", () => {
  let postId: string;

  it("requires at least one image, images only, and auth before upload", async () => {
    assert.equal((await alice.post("/api/posts", imageForm(0, { caption: "x" }))).status, 400);
    assert.equal((await alice.post("/api/posts", imageForm(1, {}, "text/plain"))).status, 400);
    assert.equal((await t.request("POST", "/api/posts", undefined, imageForm(1))).status, 401);
  });

  it("creates a post", async () => {
    const res = await bob.post("/api/posts", imageForm(2, { caption: "Sunset" }));
    assert.equal(res.status, 201);
    postId = res.body.data.id;
    assert.equal(res.body.data.caption, "Sunset");
    assert.equal(res.body.data.images.length, 2);
    assert.match(res.body.data.images[0], /^http:\/\/api\.test\/api\/media\/posts\//);
    assert.equal(res.body.data.author.username, "bob");
    assert.equal(res.body.data.likeCount, 0);
  });

  it("shows followed users' posts in the feed, not strangers'", async () => {
    await carol.post("/api/posts", imageForm(1, { caption: "carol's" }));
    await alice.post(`/api/users/${bob.id}/follow`);
    const feed = await alice.get("/api/feed");
    const captions = feed.body.data.map((p: any) => p.caption);
    assert.ok(captions.includes("Sunset"));
    assert.ok(!captions.includes("carol's"));
  });

  it("paginates with a cursor, without duplicates", async () => {
    for (let i = 0; i < 5; i++) await alice.post("/api/posts", imageForm(1, { caption: `p${i}` }));
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: any = await alice.get(`/api/users/${alice.id}/posts?limit=2${cursor ? `&cursor=${cursor}` : ""}`);
      assert.ok(page.body.data.length <= 2);
      seen.push(...page.body.data.map((p: any) => p.caption));
      cursor = page.body.nextCursor;
    } while (cursor);
    assert.deepEqual(seen, ["p4", "p3", "p2", "p1", "p0"]);
  });

  it("likes and unlikes idempotently", async () => {
    assert.equal((await alice.post(`/api/posts/${postId}/like`)).body.data.likeCount, 1);
    assert.equal((await alice.post(`/api/posts/${postId}/like`)).body.data.likeCount, 1);
    assert.equal((await alice.get(`/api/posts/${postId}`)).body.data.likedByMe, true);
    assert.equal((await bob.get(`/api/posts/${postId}`)).body.data.likedByMe, false);
    assert.equal((await alice.del(`/api/posts/${postId}/like`)).body.data.likeCount, 0);
  });

  it("saves and lists saved posts", async () => {
    await alice.post(`/api/posts/${postId}/save`);
    await alice.post(`/api/posts/${postId}/save`);
    const saved = await alice.get("/api/users/me/saved");
    assert.equal(saved.body.data.length, 1);
    assert.equal(saved.body.data[0].savedByMe, true);
    await alice.del(`/api/posts/${postId}/save`);
    assert.equal((await alice.get("/api/users/me/saved")).body.data.length, 0);
  });

  it("only lets the owner delete a post, and cleans up after it", async () => {
    await alice.post(`/api/posts/${postId}/save`);
    await alice.post(`/api/posts/${postId}/comments`, { text: "nice" });
    assert.equal((await alice.del(`/api/posts/${postId}`)).status, 404);
    assert.equal((await bob.del(`/api/posts/${postId}`)).status, 200);
    assert.equal((await bob.get(`/api/posts/${postId}`)).status, 404);
    assert.equal((await alice.get("/api/users/me/saved")).body.data.length, 0);
    assert.equal(await t.mongoose.connection.collection("comments").countDocuments({ comment: "nice" }), 0);
  });
});

describe("comments", () => {
  let postId: string, commentId: string, replyId: string;
  before(async () => {
    postId = (await bob.post("/api/posts", imageForm(1, { caption: "discuss" }))).body.data.id;
  });

  it("creates, lists and counts comments", async () => {
    const res = await alice.post(`/api/posts/${postId}/comments`, { text: "first!" });
    assert.equal(res.status, 201);
    commentId = res.body.data.id;
    assert.equal(res.body.data.author.username, "Alice");
    const list = await bob.get(`/api/posts/${postId}/comments`);
    assert.equal(list.body.data[0].text, "first!");
    assert.equal((await bob.get(`/api/posts/${postId}`)).body.data.commentCount, 1);
    assert.equal((await alice.post(`/api/posts/${postId}/comments`, { text: "  " })).status, 400);
  });

  it("replies, and only the right people can delete replies", async () => {
    const res = await bob.post(`/api/comments/${commentId}/replies`, { text: "thanks" });
    assert.equal(res.status, 201);
    replyId = res.body.data.id;
    assert.equal((await t.request("GET", `/api/posts/${postId}/comments`, alice.token)).body.data[0].replies[0].author.username, "bob");
    assert.equal((await carol.del(`/api/comments/${commentId}/replies/${replyId}`)).status, 403);
    assert.equal((await alice.del(`/api/comments/${commentId}/replies/${replyId}`)).status, 200);
  });

  it("lets the post owner delete a comment, but not strangers", async () => {
    assert.equal((await carol.del(`/api/comments/${commentId}`)).status, 403);
    assert.equal((await bob.del(`/api/comments/${commentId}`)).status, 200);
    assert.equal((await bob.get(`/api/posts/${postId}`)).body.data.commentCount, 0);
  });
});

describe("stories", () => {
  it("shares, groups (yours first) and deletes stories", async () => {
    const bobPost = (await bob.post("/api/posts", imageForm(1, { caption: "story" }))).body.data.id;
    const alicePost = (await alice.post("/api/posts", imageForm(1, { caption: "mine" }))).body.data.id;
    const created = await bob.post("/api/stories", { postId: bobPost });
    assert.equal(created.status, 201);
    await alice.post("/api/stories", { postId: alicePost });
    await carol.post("/api/stories", { postId: alicePost }); // alice doesn't follow carol

    const groups = (await alice.get("/api/stories")).body.data;
    assert.deepEqual(groups.map((g: any) => g.author.username), ["Alice", "bob"]);
    assert.equal(groups[1].stories[0].post.caption, "story");

    assert.equal((await alice.del(`/api/stories/${created.body.data.id}`)).status, 404);
    assert.equal((await bob.del(`/api/stories/${created.body.data.id}`)).status, 200);
  });
});

describe("chats and realtime messages", () => {
  let chatId: string;

  it("opens a chat once and returns the same chat after", async () => {
    const first = await alice.post("/api/chats", { userId: bob.id });
    assert.equal(first.status, 201);
    chatId = first.body.data.id;
    assert.equal(first.body.data.participants[0].username, "bob");
    const again = await bob.post("/api/chats", { userId: alice.id });
    assert.equal(again.status, 200);
    assert.equal(again.body.data.id, chatId);
    assert.equal((await alice.post("/api/chats", { userId: alice.id })).status, 400);
  });

  it("rejects sockets without a valid token", async () => {
    await assert.rejects(t.connectSocket("nope"), /Unauthorized/);
  });

  it("delivers REST messages live to every tab of the other person", async () => {
    const [bobTab1, bobTab2] = await Promise.all([t.connectSocket(bob.token), t.connectSocket(bob.token)]);
    const got = Promise.all([nextEvent(bobTab1, "message:new"), nextEvent(bobTab2, "message:new")]);
    const sent = await alice.post(`/api/chats/${chatId}/messages`, { text: "hi bob" });
    assert.equal(sent.status, 201);
    const [m1, m2] = await got;
    assert.equal(m1.text, "hi bob");
    assert.equal(m2.id, sent.body.data.id);
  });

  it("sends over the socket with an ack, and saves the message", async () => {
    const bobSocket = await t.connectSocket(bob.token);
    const aliceSocket = await t.connectSocket(alice.token);
    const got = nextEvent(aliceSocket, "message:new");
    const ack = await bobSocket.timeout(2000).emitWithAck("message:send", { chatId, text: "hey alice" });
    assert.equal(ack.success, true);
    assert.equal((await got).text, "hey alice");
    const history = await alice.get(`/api/chats/${chatId}/messages`);
    assert.deepEqual(history.body.data.map((m: any) => m.text), ["hey alice", "hi bob"]);
    const outsider = await t.connectSocket(carol.token);
    const denied = await outsider.timeout(2000).emitWithAck("message:send", { chatId, text: "intrude" });
    assert.equal(denied.success, false);
  });

  it("lists chats with participants and the last message", async () => {
    const chats = (await alice.get("/api/chats")).body.data;
    assert.equal(chats[0].id, chatId);
    assert.equal(chats[0].lastMessage.text, "hey alice");
  });

  it("keeps strangers out", async () => {
    assert.equal((await carol.get(`/api/chats/${chatId}/messages`)).status, 404);
    assert.equal((await carol.post(`/api/chats/${chatId}/messages`, { text: "x" })).status, 404);
    assert.equal((await carol.del(`/api/chats/${chatId}`)).status, 404);
  });

  it("edits and deletes only your own messages, live", async () => {
    const msg = (await alice.post(`/api/chats/${chatId}/messages`, { text: "typo" })).body.data;
    assert.equal((await bob.patch(`/api/messages/${msg.id}`, { text: "hacked" })).status, 404);
    const bobSocket = await t.connectSocket(bob.token);
    const updated = nextEvent(bobSocket, "message:updated");
    const edited = await alice.patch(`/api/messages/${msg.id}`, { text: "fixed" });
    assert.equal(edited.body.data.text, "fixed");
    assert.ok(edited.body.data.editedAt);
    assert.equal((await updated).text, "fixed");
    const deleted = nextEvent(bobSocket, "message:deleted");
    assert.equal((await bob.del(`/api/messages/${msg.id}`)).status, 404);
    assert.equal((await alice.del(`/api/messages/${msg.id}`)).status, 200);
    assert.deepEqual(await deleted, { id: msg.id, chatId });
  });
});

describe("system", () => {
  it("reports health", async () => {
    const res = await t.request("GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.db, true);
  });

  it("redirects images to signed S3 links and rejects other paths", async () => {
    const ok = await t.request("GET", "/api/media/posts/u/x.png");
    assert.equal(ok.status, 302);
    assert.match(ok.headers.get("location")!, /X-Amz-Signature/);
    assert.equal((await t.request("GET", "/api/media/secrets/x")).status, 404);
    assert.equal((await t.request("GET", "/api/media/posts/..%2F..%2Fx")).status, 404);
  });

  it("sends security, rate-limit and cross-origin image headers", async () => {
    const res = await alice.get("/api/users/me");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.ok(res.headers.get("ratelimit-policy"));
    assert.equal(res.headers.get("cross-origin-resource-policy"), "cross-origin");
  });

  it("answers malformed JSON and unknown routes with the error envelope", async () => {
    const bad = await fetch(`${t.base}/api/chats`, {
      method: "POST",
      headers: { Authorization: `Bearer ${alice.token}`, "Content-Type": "application/json" },
      body: "{not json",
    });
    assert.equal(bad.status, 400);
    const unknown = await alice.get("/api/nope");
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.success, false);
  });

  it("implements every route in the OpenAPI spec", async () => {
    const spec = (await t.request("GET", "/api/openapi.json")).body;
    const fakeId = "aaaaaaaaaaaaaaaaaaaaaaaa";
    for (const [path, methods] of Object.entries<any>(spec.paths)) {
      const url = path
        .replace("{key}", "posts/u/x.png")
        .replace("{replyId}", "00000000-0000-4000-8000-000000000000")
        .replace(/\{id\}/g, fakeId);
      for (const method of Object.keys(methods)) {
        const res = await t.request(method.toUpperCase(), url, alice.token, method === "get" || method === "delete" ? undefined : {});
        assert.notEqual(res.body?.message, "Route not found", `${method.toUpperCase()} ${path} is documented but not implemented`);
      }
    }
  });
});
