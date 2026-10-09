// Repairs data left behind by the 2023 bugs (see docs/CHANGES.md):
//   1. old expiring S3 links → permanent S3 keys (files are copied to a clean key with the right type)
//   2. messages stored in the wrong chat
//   3. references to things that no longer exist (likes, comment ids, follows, saves, stories…)
//
//   node scripts/cleanup-data.mjs                                    dry run (changes nothing)
//   node scripts/cleanup-data.mjs --apply                            for real
//   node scripts/cleanup-data.mjs --move-messages <fromChat>:<toChat> [--apply]
//        also move every message of one chat into another (when a whole conversation is misplaced)
//
// Database changes run in one transaction and a JSON backup is written to backups/ first.
// S3 files are copied, never deleted, so the old ones stay as a fallback.
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { S3Client, HeadObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
dotenv.config({ quiet: true });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const moveArg = args[args.indexOf("--move-messages") + 1];
const moves = args.includes("--move-messages") ? [moveArg.split(":")] : [];

const BUCKET = process.env.AWS_BUCKET || "fwstorage-trial";
const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-west-2",
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
});
const TYPES = { jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };

await mongoose.connect(process.env.MONGODBURL);
const db = mongoose.connection.db;
const col = (name) => db.collection(name);
const { ObjectId } = mongoose.Types;
const log = (msg) => console.log(`  ${msg}`);
console.log(apply ? "APPLYING CHANGES\n" : "DRY RUN (nothing will change)\n");

// ---- backup ----
const COLLECTIONS = ["users", "posts", "comments", "savedposts", "stories", "followings", "chats", "messages"];
if (apply) {
  const backup = {};
  for (const name of COLLECTIONS) backup[name] = await col(name).find().toArray();
  fs.mkdirSync("backups", { recursive: true });
  const file = path.join("backups", `cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Backup written to ${file}\n`);
}

// ---- 1. S3 links → keys (copy files outside the transaction; S3 isn't transactional) ----
console.log("1. Old S3 links");
// Returns the new key for an old signed URL, or null if it isn't one of ours / the file is gone
const migrateUrl = async (value, label) => {
  if (typeof value !== "string" || !value.startsWith("http")) return null;
  const url = new URL(value);
  if (!url.hostname.startsWith(`${BUCKET}.s3`)) return null;
  const oldKey = decodeURIComponent(url.pathname.slice(1)); // old keys started with "/"
  const newKey = oldKey.replace(/^\/+/, "");
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: oldKey }));
  } catch {
    log(`⚠ ${label}: file ${oldKey} no longer exists, left unchanged`);
    return null;
  }
  const extension = newKey.split(".").pop().toLowerCase();
  if (apply) {
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: encodeURIComponent(`${BUCKET}/${oldKey}`),
      Key: newKey,
      ContentType: TYPES[extension] ?? "application/octet-stream",
      MetadataDirective: "REPLACE",
    }));
  }
  log(`${label}: ${oldKey} → ${newKey} (${TYPES[extension] ?? "unknown type"})`);
  return newKey;
};
const imageUpdates = [];
for (const post of await col("posts").find({ imageUrl: { $elemMatch: { $regex: "^http" } } }).toArray()) {
  const keys = [];
  for (const url of post.imageUrl) keys.push((await migrateUrl(url, `post ${post._id}`)) ?? url);
  imageUpdates.push(["posts", post._id, { imageUrl: keys }]);
}
for (const user of await col("users").find({ ProfileUrl: { $regex: "^http" } }).toArray()) {
  const key = await migrateUrl(user.ProfileUrl, `profile ${user.Username}`);
  if (key) imageUpdates.push(["users", user._id, { ProfileUrl: key }]);
}

const session = await mongoose.startSession();
try {
  session.startTransaction();
  const o = { session };
  for (const [name, _id, set] of imageUpdates) await col(name).updateOne({ _id }, { $set: set }, o);

  // ---- 2. messages in the wrong chat ----
  console.log("\n2. Misplaced messages");
  for (const [from, to] of moves) {
    const target = await col("chats").findOne({ _id: new ObjectId(to) }, o);
    if (!target) throw new Error(`--move-messages: chat ${to} not found`);
    log(`moved all messages of chat ${from} → ${to}: ${(await col("messages").updateMany({ chatId: new ObjectId(from) }, { $set: { chatId: target._id } }, o)).modifiedCount}`);
  }
  // A message whose sender isn't in its chat: move it to the one chat between the sender
  // and the other member(s), if exactly one exists
  const chats = await col("chats").find({}, o).toArray();
  for (const message of await col("messages").find({}, o).toArray()) {
    const chat = chats.find((c) => c._id.equals(message.chatId));
    if (!chat || chat.members.some((m) => m.equals(message.senderId))) continue;
    const candidates = chats.filter((c) => c.members.some((m) => m.equals(message.senderId)) && c.members.some((m) => chat.members.some((x) => x.equals(m))));
    if (candidates.length === 1) {
      await col("messages").updateOne({ _id: message._id }, { $set: { chatId: candidates[0]._id } }, o);
      log(`message ${message._id} moved to chat ${candidates[0]._id}`);
    } else {
      log(`⚠ message ${message._id}: sender isn't in the chat and the right chat is unclear; left as is`);
    }
  }

  // ---- 3. references to things that no longer exist ----
  console.log("\n3. Broken references");
  const idsOf = async (name) => (await col(name).find({}, { ...o, projection: { _id: 1 } }).toArray()).map((d) => d._id);
  const userIds = await idsOf("users");
  const postIds = await idsOf("posts");
  const chatIds = await idsOf("chats");
  const report = (label, result) => {
    const n = result.modifiedCount ?? result.deletedCount ?? 0;
    if (n) log(`${label}: ${n}`);
  };
  report("posts: likes from deleted users removed", await col("posts").updateMany({ likes: { $elemMatch: { $nin: userIds } } }, { $pull: { likes: { $nin: userIds } } }, o));
  report("comments on deleted posts deleted", await col("comments").deleteMany({ postId: { $nin: postIds } }, o));
  report("saved posts of deleted posts/users deleted", await col("savedposts").deleteMany({ $or: [{ postId: { $nin: postIds } }, { userId: { $nin: userIds } }] }, o));
  report("stories of deleted posts/users deleted", await col("stories").deleteMany({ $or: [{ postId: { $nin: postIds } }, { userId: { $nin: userIds } }] }, o));
  report("follows involving deleted users deleted", await col("followings").deleteMany({ $or: [{ userID: { $nin: userIds } }, { followingID: { $nin: userIds } }] }, o));
  report("messages in deleted chats deleted", await col("messages").deleteMany({ chatId: { $nin: chatIds } }, o));
  const orphanComments = await col("comments").countDocuments({ userId: { $nin: userIds } }, o);
  if (orphanComments) log(`⚠ ${orphanComments} comments were written by deleted users (left as is; decide yourself)`);
  const orphanPosts = await col("posts").countDocuments({ userId: { $nin: userIds } }, o);
  if (orphanPosts) log(`⚠ ${orphanPosts} posts belong to deleted users (left as is; decide yourself)`);
  const brokenChats = await col("chats").countDocuments({ members: { $elemMatch: { $nin: userIds } } }, o);
  if (brokenChats) log(`⚠ ${brokenChats} chats include a deleted user (left as is)`);


  if (apply) {
    await session.commitTransaction();
    console.log("\n✅ Cleanup committed.");
  } else {
    await session.abortTransaction();
    console.log("\nDry run: nothing was changed. Re-run with --apply.");
  }
} catch (error) {
  await session.abortTransaction();
  console.error("\n❌ Cleanup failed, database unchanged:", error.message);
  process.exitCode = 1;
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
