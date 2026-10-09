// Merges Friendwave accounts into one: everything owned by the secondary accounts
// is moved to the primary, then the secondary accounts are deleted.
// Use it after linking identities in Auth0 (see docs/AUTH.md → Account linking).
//
//   node scripts/merge-users.mjs <primaryUserId> <secondaryUserId> [...more]           dry run
//   node scripts/merge-users.mjs <primaryUserId> <secondaryUserId> [...more] --apply   for real
//
// Runs in a transaction (all or nothing) and writes a JSON backup to backups/ first.
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
dotenv.config({ quiet: true });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const ids = args.filter((a) => a !== "--apply");
if (ids.length < 2 || !ids.every((id) => mongoose.isValidObjectId(id))) {
  console.error("Usage: node scripts/merge-users.mjs <primaryUserId> <secondaryUserId> [...] [--apply]");
  process.exit(1);
}
const { ObjectId } = mongoose.Types;
const P = new ObjectId(ids[0]);
const S = ids.slice(1).map((id) => new ObjectId(id));
const Pstr = String(P);
const Sstr = S.map(String);
const all = [P, ...S];
const isSecondary = (id) => Sstr.includes(String(id));
const toPrimary = (id) => (isSecondary(id) ? P : id);

await mongoose.connect(process.env.MONGODBURL);
const db = mongoose.connection.db;
const col = (name) => db.collection(name);

const users = await col("users").find({ _id: { $in: all } }).toArray();
if (users.length !== all.length) {
  console.error("Not all users found:", all.filter((id) => !users.some((u) => u._id.equals(id))).map(String));
  process.exit(1);
}
const name = (id) => users.find((u) => u._id.equals(id))?.Username ?? String(id);
console.log(`Primary:   ${name(P)} (${Pstr})`);
console.log(`Secondary: ${S.map((id) => `${name(id)} (${id})`).join(", ")}\n`);

// ---- backup every document that mentions one of these users ----
const backup = {
  users: await col("users").find({ _id: { $in: all } }).toArray(),
  posts: await col("posts").find({ $or: [{ userId: { $in: all } }, { likes: { $in: all } }] }).toArray(),
  comments: await col("comments").find({ $or: [{ userId: { $in: all } }, { "replies.userId": { $in: [Pstr, ...Sstr] } }] }).toArray(),
  savedposts: await col("savedposts").find({ userId: { $in: all } }).toArray(),
  stories: await col("stories").find({ userId: { $in: all } }).toArray(),
  followings: await col("followings").find({ $or: [{ userID: { $in: all } }, { followingID: { $in: all } }] }).toArray(),
  chats: await col("chats").find({ members: { $in: all } }).toArray(),
};
backup.messages = await col("messages").find({ chatId: { $in: backup.chats.map((c) => c._id) } }).toArray();
if (apply) {
  fs.mkdirSync("backups", { recursive: true });
  const file = path.join("backups", `merge-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Backup written to ${file}\n`);
}

const log = (msg) => console.log(`  ${msg}`);
const session = await mongoose.startSession();
try {
  session.startTransaction();
  const o = { session };

  // Posts, comments, stories, messages: change the owner
  log(`posts moved: ${(await col("posts").updateMany({ userId: { $in: S } }, { $set: { userId: P } }, o)).modifiedCount}`);
  log(`comments moved: ${(await col("comments").updateMany({ userId: { $in: S } }, { $set: { userId: P } }, o)).modifiedCount}`);
  log(`replies moved: ${(await col("comments").updateMany(
    { "replies.userId": { $in: Sstr } },
    { $set: { "replies.$[r].userId": Pstr } },
    { ...o, arrayFilters: [{ "r.userId": { $in: Sstr } }] }
  )).modifiedCount} comments`);
  log(`stories moved: ${(await col("stories").updateMany({ userId: { $in: S } }, { $set: { userId: P } }, o)).modifiedCount}`);

  // Likes: a secondary's like becomes the primary's like (once, even if both liked)
  await col("posts").updateMany({ likes: { $in: S } }, { $addToSet: { likes: P } }, o);
  log(`likes merged on: ${(await col("posts").updateMany({ likes: { $in: S } }, { $pull: { likes: { $in: S } } }, o)).modifiedCount} posts`);

  // Saved posts: move, unless the primary already saved the same post
  let savedMoved = 0, savedDropped = 0;
  for (const save of await col("savedposts").find({ userId: { $in: S } }, o).toArray()) {
    if (await col("savedposts").findOne({ userId: P, postId: save.postId }, o)) {
      await col("savedposts").deleteOne({ _id: save._id }, o); savedDropped++;
    } else {
      await col("savedposts").updateOne({ _id: save._id }, { $set: { userId: P } }, o); savedMoved++;
    }
  }
  log(`saved posts moved: ${savedMoved}, duplicates dropped: ${savedDropped}`);

  // Follow relationships: point them at the primary; drop self-follows and duplicates
  for (const [collection, a, b] of [["followings", "userID", "followingID"]]) {
    const seen = new Set();
    let moved = 0, dropped = 0;
    const docs = await col(collection).find({ $or: [{ [a]: { $in: all } }, { [b]: { $in: all } }] }, o).toArray();
    // Keep untouched pairs first, so an existing primary relationship wins over a moved one
    docs.sort((x, y) => (isSecondary(x[a]) || isSecondary(x[b]) ? 1 : 0) - (isSecondary(y[a]) || isSecondary(y[b]) ? 1 : 0));
    for (const doc of docs) {
      const from = toPrimary(doc[a]), to = toPrimary(doc[b]);
      const key = `${from}:${to}`;
      if (from.equals(to) || seen.has(key)) {
        await col(collection).deleteOne({ _id: doc._id }, o); dropped++;
        continue;
      }
      seen.add(key);
      if (!from.equals(doc[a]) || !to.equals(doc[b])) {
        await col(collection).updateOne({ _id: doc._id }, { $set: { [a]: from, [b]: to } }, o); moved++;
      }
    }
    log(`${collection}: moved ${moved}, dropped ${dropped} (self-follows/duplicates)`);
  }

  // Chats: swap in the primary; a chat with yourself is deleted; a duplicate chat
  // with the same person has its messages moved into the existing one
  let chatsMoved = 0, chatsDeleted = 0, chatsMerged = 0;
  for (const chat of await col("chats").find({ members: { $in: S } }, o).toArray()) {
    const members = [...new Map(chat.members.map((m) => [String(toPrimary(m)), toPrimary(m)])).values()];
    if (members.length < 2) {
      await col("messages").deleteMany({ chatId: chat._id }, o);
      await col("chats").deleteOne({ _id: chat._id }, o); chatsDeleted++;
      continue;
    }
    const existing = await col("chats").findOne({ _id: { $ne: chat._id }, members: { $all: members, $size: members.length } }, o);
    if (existing) {
      await col("messages").updateMany({ chatId: chat._id }, { $set: { chatId: existing._id } }, o);
      await col("chats").deleteOne({ _id: chat._id }, o); chatsMerged++;
    } else {
      await col("chats").updateOne({ _id: chat._id }, { $set: { members } }, o); chatsMoved++;
    }
  }
  log(`chats moved: ${chatsMoved}, merged into existing: ${chatsMerged}, self-chats deleted: ${chatsDeleted}`);
  log(`messages moved: ${(await col("messages").updateMany({ senderId: { $in: S } }, { $set: { senderId: P } }, o)).modifiedCount}`);

  log(`secondary accounts deleted: ${(await col("users").deleteMany({ _id: { $in: S } }, o)).deletedCount}`);

  const count = (name, filter) => col(name).countDocuments(filter, o);
  console.log(`\nResult for ${name(P)}: ${await count("posts", { userId: P })} posts, ${await count("followings", { followingID: P })} followers, ${await count("followings", { userID: P })} following, ${await count("savedposts", { userId: P })} saved, ${await count("stories", { userId: P })} stories`);

  if (apply) {
    await session.commitTransaction();
    console.log("\n✅ Merge committed.");
  } else {
    await session.abortTransaction();
    console.log("\nDry run: nothing was changed. Re-run with --apply to merge.");
  }
} catch (error) {
  await session.abortTransaction();
  console.error("\n❌ Merge failed, nothing was changed:", error.message);
  process.exitCode = 1;
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
