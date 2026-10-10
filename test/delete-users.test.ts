import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
// @ts-expect-error -- plain JS module (scripts/), no type declarations
import { applyDeletion, backupFor, planDeletion } from "../scripts/lib/delete-users-core.mjs";

// scripts/delete-users.mjs: removes accounts and everything that points at them,
// and leaves the kept accounts exactly as they were
let mongo: MongoMemoryServer, client: MongoClient, db: Db;
const id = () => new ObjectId();
const u = { keep1: id(), keep2: id(), gone1: id(), gone2: id() };
const p = { keep1: id(), gone1: id() };
const chat = { kept: id(), mixed: id() };

before(async () => {
  mongo = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongo.getUri());
  db = client.db("t");
});
after(async () => {
  await client.close();
  await mongo.stop();
});

// Two kept users (lkuuybj, man.like.lawrence) and two test accounts (hetty, glover)
// tangled up with each other in every way
beforeEach(async () => {
  await db.dropDatabase();
  await db.collection("users").insertMany([
    { _id: u.keep1, Username: "lkuuybj", Name: "L" },
    { _id: u.keep2, Username: "Man.Like.Lawrence", Name: "Lawrence" },
    { _id: u.gone1, Username: "hetty", Name: "Hetty", ProfileUrl: "avatars/h.png" },
    { _id: u.gone2, Username: "glover", Name: "Glover" },
  ]);
  await db.collection("posts").insertMany([
    { _id: p.keep1, userId: u.keep1, imageUrl: ["a.png"], likes: [u.keep2, u.gone1, u.gone2] },
    { _id: p.gone1, userId: u.gone1, imageUrl: ["b.png", "c.png"], likes: [u.keep1] },
  ]);
  await db.collection("comments").insertMany([
    // on a kept post: a kept comment with replies from both sides, and a comment by hetty
    {
      userId: u.keep2,
      postId: p.keep1,
      comment: "nice",
      replies: [
        { replyId: "r1", userId: String(u.keep1), reply: "thanks" },
        { replyId: "r2", userId: String(u.gone1), reply: "hi" },
        { replyId: "r3", userId: u.gone2, reply: "old-style id" },
      ],
    },
    { userId: u.gone1, postId: p.keep1, comment: "from hetty", replies: [] },
    // on hetty's post: a comment by a kept user (goes with the post)
    { userId: u.keep1, postId: p.gone1, comment: "on hetty's post", replies: [] },
  ]);
  await db.collection("followings").insertMany([
    { userID: u.keep1, followingID: u.keep2 },
    { userID: u.keep1, followingID: u.gone1 },
    { userID: u.gone2, followingID: u.keep2 },
  ]);
  await db.collection("savedposts").insertMany([
    { userId: u.keep2, postId: p.keep1 },
    { userId: u.keep1, postId: p.gone1 },
    { userId: u.gone1, postId: p.keep1 },
  ]);
  await db.collection("stories").insertMany([
    { storyId: "s1", userId: u.keep1, postId: p.keep1 },
    { storyId: "s2", userId: u.keep1, postId: p.gone1 },
    { storyId: "s3", userId: u.gone2, postId: p.keep1 },
  ]);
  await db.collection("chats").insertMany([
    { _id: chat.kept, members: [u.keep1, u.keep2] },
    { _id: chat.mixed, members: [u.keep1, u.gone1] },
  ]);
  await db.collection("messages").insertMany([
    { chatId: chat.kept, senderId: u.keep1, message: "yo" },
    { chatId: chat.mixed, senderId: u.gone1, message: "hey" },
    { chatId: chat.mixed, senderId: u.keep1, message: "hello" },
  ]);
  await db.collection("notifications").insertMany([
    { userId: u.keep1, actorId: u.keep2, type: "follow" },
    { userId: u.keep1, actorId: u.gone1, type: "like", postId: p.keep1 },
    { userId: u.gone2, actorId: u.keep1, type: "follow" },
    { userId: u.keep1, actorId: u.keep2, type: "comment", postId: p.gone1 },
  ]);
});

const keep = ["lkuuybj", "man.like.lawrence"];
const snapshot = async () => {
  const out: Record<string, unknown[]> = {};
  for (const name of ["users", "posts", "comments", "followings", "savedposts", "stories", "chats", "messages", "notifications"])
    out[name] = await db.collection(name).find().sort({ _id: 1 }).toArray();
  return out;
};

describe("delete-users script", () => {
  it("plans without changing anything (dry run), with the right counts", async () => {
    const before = await snapshot();
    const plan = await planDeletion(db, { keep });
    assert.deepEqual(plan.targets.map((t: { Username: string }) => t.Username).sort(), ["glover", "hetty"]);
    assert.deepEqual(plan.kept.map((t: { Username: string }) => t.Username).sort(), ["Man.Like.Lawrence", "lkuuybj"]);
    assert.equal(plan.counts.users, 2);
    assert.equal(plan.counts.posts, 1);
    assert.equal(plan.counts.comments, 2); // hetty's comment + the comment on hetty's post
    assert.equal(plan.counts.chats, 1);
    assert.equal(plan.counts.messages, 2);
    assert.equal(plan.files, 3); // b.png, c.png, hetty's avatar
    assert.deepEqual(await snapshot(), before);
  });

  it("deletes them and everything pointing at them; kept accounts stay intact", async () => {
    const plan = await planDeletion(db, { keep });
    const backup = await backupFor(db, plan);
    assert.equal(backup.users.length, 2);
    await applyDeletion(db, plan);
    const after = await snapshot();
    const gone = [String(u.gone1), String(u.gone2)];
    const mentions = (doc: unknown) => gone.some((g) => JSON.stringify(doc).includes(g)) || JSON.stringify(doc).includes(String(p.gone1));
    for (const [name, docs] of Object.entries(after))
      for (const doc of docs) assert.ok(!mentions(doc), `${name} still refers to a deleted user or post: ${JSON.stringify(doc)}`);

    assert.equal(after.users.length, 2);
    const post = (await db.collection("posts").findOne({ _id: p.keep1 }))!;
    assert.deepEqual(post.likes.map(String), [String(u.keep2)]); // their likes are gone, the kept one stays
    const comment = (await db.collection("comments").findOne({ comment: "nice" }))!;
    assert.deepEqual(comment.replies.map((r: { replyId: string }) => r.replyId), ["r1"]);
    assert.equal(after.followings.length, 1);
    assert.equal(after.savedposts.length, 1);
    assert.equal(after.stories.length, 1);
    assert.deepEqual(after.chats.map((c) => String((c as { _id: ObjectId })._id)), [String(chat.kept)]);
    assert.equal(after.messages.length, 1);
    assert.equal(after.notifications.length, 1);
  });

  it("--delete names accounts directly", async () => {
    const plan = await planDeletion(db, { remove: ["HETTY"] });
    assert.deepEqual(plan.targets.map((t: { Username: string }) => t.Username), ["hetty"]);
  });

  it("refuses a misspelt name, deleting everyone, or both flags", async () => {
    await assert.rejects(planDeletion(db, { keep: ["lkuuybj", "man.like.lawrnce"] }), /No user named man.like.lawrnce/);
    await assert.rejects(planDeletion(db, { remove: ["lkuuybj", "man.like.lawrence", "hetty", "glover"] }), /every account/);
    await assert.rejects(planDeletion(db, { keep, remove: ["hetty"] }), /either --keep or --delete/);
    assert.equal(await db.collection("users").countDocuments(), 4);
  });
});
