// One-off migration for the API v2 data model (October 2026). Safe to re-run.
//   - every follow lives in `followings` only: copies anything that exists
//     only in the old mirror `followers` collection, then drops `followers`
//   - removes duplicated fields the code no longer uses: users' UserID/Followers/
//     Followings/Posts/SavedPosts/Stories arrays, posts' postId/comments/saved,
//     messages' dateTime (createdAt is used instead)
//   - removes duplicate follows/saves so the new unique indexes can be built
//
//   node scripts/migrate-v2.mjs            dry run
//   node scripts/migrate-v2.mjs --apply    for real (writes a backup to backups/ first)
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
dotenv.config({ quiet: true });

const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGODBURL);
const db = mongoose.connection.db;
const col = (name) => db.collection(name);
const exists = async (name) => (await db.listCollections({ name }).toArray()).length > 0;
const log = (msg) => console.log(`  ${msg}`);
console.log(apply ? "APPLYING CHANGES\n" : "DRY RUN (nothing will change)\n");

if (apply) {
  const backup = {};
  for (const { name } of await db.listCollections().toArray()) backup[name] = await col(name).find().toArray();
  fs.mkdirSync("backups", { recursive: true });
  const file = path.join("backups", `migrate-v2-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Backup written to ${file}\n`);
}

const hasFollowers = await exists("followers");
const session = await mongoose.startSession();
try {
  session.startTransaction();
  const o = { session };

  // 1. follows: followers {userID: X, followerID: Y} means "Y follows X"
  if (hasFollowers) {
    let copied = 0;
    for (const f of await col("followers").find({}, o).toArray()) {
      const pair = { userID: f.followerID, followingID: f.userID };
      if (!(await col("followings").findOne(pair, o))) {
        await col("followings").insertOne(pair, o);
        copied++;
      }
    }
    log(`follows only found in 'followers', copied to 'followings': ${copied}`);
  }

  // 2. duplicates that would block the new unique indexes
  for (const [name, a, b] of [["followings", "userID", "followingID"], ["savedposts", "userId", "postId"]]) {
    let removed = 0;
    const groups = await col(name).aggregate([
      { $group: { _id: { a: `$${a}`, b: `$${b}` }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ], o).toArray();
    for (const g of groups) removed += (await col(name).deleteMany({ _id: { $in: g.ids.slice(1) } }, o)).deletedCount;
    log(`duplicate ${name} removed: ${removed}`);
  }

  // 3. unused duplicated fields
  const unset = async (name, fields) => {
    const filter = { $or: fields.map((f) => ({ [f]: { $exists: true } })) };
    const n = (await col(name).updateMany(filter, { $unset: Object.fromEntries(fields.map((f) => [f, ""])) }, o)).modifiedCount;
    log(`${name}: removed ${fields.join(", ")} from ${n} documents`);
  };
  // Messages created before timestamps were used: keep their time as createdAt
  const fixed = (await col("messages").updateMany({ createdAt: { $exists: false }, dateTime: { $exists: true } }, [{ $set: { createdAt: "$dateTime" } }], o)).modifiedCount;
  log(`messages given createdAt from dateTime: ${fixed}`);
  // Chats are sorted by updatedAt (= time of the last message)
  let chatsTouched = 0;
  for (const chat of await col("chats").find({}, o).toArray()) {
    const [last] = await col("messages").find({ chatId: chat._id }, o).sort({ createdAt: -1 }).limit(1).toArray();
    if (last && +last.createdAt !== +chat.updatedAt) {
      await col("chats").updateOne({ _id: chat._id }, { $set: { updatedAt: last.createdAt } }, o);
      chatsTouched++;
    }
  }
  log(`chats whose updatedAt was set to their last message: ${chatsTouched}`);
  await unset("users", ["UserID", "Followers", "Followings", "Posts", "SavedPosts", "Stories"]);
  await unset("posts", ["postId", "comments", "saved"]);
  await unset("messages", ["dateTime"]);

  if (apply) await session.commitTransaction();
  else await session.abortTransaction();
} catch (error) {
  await session.abortTransaction();
  console.error("\n❌ Migration failed, nothing was changed:", error.message);
  process.exit(1);
} finally {
  await session.endSession();
}

// 4. things that can't run inside a transaction
if (hasFollowers) log(`${apply ? "dropped" : "would drop"} the 'followers' collection (${await col("followers").countDocuments()} documents)`);
if (apply && hasFollowers) await col("followers").drop();
const usersIndexes = (await col("users").indexes()).map((i) => i.name);
if (usersIndexes.includes("Stories_1")) {
  log(`${apply ? "dropped" : "would drop"} unused index users.Stories_1`);
  if (apply) await col("users").dropIndex("Stories_1");
}

console.log(apply ? "\n✅ Migration done. Start the app once to build the new indexes." : "\nDry run: nothing was changed. Re-run with --apply.");
await mongoose.disconnect();
