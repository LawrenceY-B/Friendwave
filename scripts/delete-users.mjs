// Deletes accounts and everything that belongs to them: their posts (with the comments,
// stories, saves and notifications on them), comments and replies, likes, follows both
// ways, saves, stories, chats with their messages, and notifications.
//
//   node scripts/delete-users.mjs --keep lkuuybj,man.like.lawrence           dry run: shows who and what would go
//   node scripts/delete-users.mjs --keep lkuuybj,man.like.lawrence --apply   for real
//   node scripts/delete-users.mjs --delete hetty,glover [--apply]            or name the accounts to delete
//
// Uses MONGODBURL from .env (it prints which database first). --apply writes a JSON backup
// of everything it removes or edits to backups/ and then runs in one transaction.
// Photos on S3 are left in place (private, and it keeps a restore from the backup possible).
import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { applyDeletion, backupFor, planDeletion } from "./lib/delete-users-core.mjs";
dotenv.config({ quiet: true });

const args = process.argv.slice(2);
const listArg = (flag) => (args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : undefined);
const keep = listArg("--keep");
const remove = listArg("--delete");
const apply = args.includes("--apply");

await mongoose.connect(process.env.MONGODBURL);
const db = mongoose.connection.db;
console.log(`Database: ${mongoose.connection.host} / ${db.databaseName}`);
console.log(apply ? "APPLYING CHANGES\n" : "DRY RUN (nothing will change)\n");

try {
  const plan = await planDeletion(db, { keep, remove });
  console.log(`Keeping (${plan.kept.length}):  ${plan.kept.map((u) => u.Username).join(", ")}`);
  console.log(`Deleting (${plan.targets.length}): ${plan.targets.map((u) => `${u.Username} (${u.Name})`).join(", ") || "nobody"}\n`);
  for (const [name, n] of Object.entries(plan.counts)) console.log(`  ${name.padEnd(36)} ${n}`);
  console.log(`  ${"S3 photos left in place".padEnd(36)} ${plan.files}\n`);

  if (plan.targets.length === 0) console.log("Nothing to delete.");
  else if (!apply) console.log("Dry run only. Add --apply to delete.");
  else {
    fs.mkdirSync("backups", { recursive: true });
    const file = path.join("backups", `delete-users-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(await backupFor(db, plan), null, 2));
    console.log(`Backup written to ${file}`);
    const session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await applyDeletion(db, plan, session);
    });
    await session.endSession();
    console.log("Done:", result);
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
