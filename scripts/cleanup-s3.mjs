// Deletes photos on S3 that nothing in the database points to any more (left behind by
// deleted accounts, posts or messages). Only looks in the app's own folders (posts/,
// profile/, chat/) and skips anything uploaded in the last hour.
//
//   npm run cleanup-s3              dry run: lists what would be deleted
//   npm run cleanup-s3 -- --apply   for real (the list is saved to backups/ first)
//
// Uses MONGODBURL and the AWS_* variables from .env.
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { findOrphans } from "../src/services/user-deletion.ts";
dotenv.config({ quiet: true });

const apply = process.argv.includes("--apply");
const BUCKET = process.env.AWS_BUCKET || "fwstorage-trial";
const FOLDERS = ["posts/", "profile/", "chat/"];
const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-west-2",
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
});

// Every file in the app's folders
const objects = [];
for (const Prefix of FOLDERS) {
  let ContinuationToken;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix, ContinuationToken }));
    for (const o of page.Contents ?? []) objects.push({ key: o.Key, lastModified: o.LastModified, size: o.Size ?? 0 });
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

// Every file the database still uses
await mongoose.connect(process.env.MONGODBURL);
const db = mongoose.connection.db;
const referenced = new Set();
const isKey = (v) => typeof v === "string" && v && !v.startsWith("http");
for (const p of await db.collection("posts").find({}, { projection: { imageUrl: 1 } }).toArray())
  (p.imageUrl ?? []).filter(isKey).forEach((k) => referenced.add(k));
for (const u of await db.collection("users").find({}, { projection: { ProfileUrl: 1 } }).toArray())
  if (isKey(u.ProfileUrl)) referenced.add(u.ProfileUrl);
for (const m of await db.collection("messages").find({ imageUrl: { $exists: true } }, { projection: { imageUrl: 1 } }).toArray())
  if (isKey(m.imageUrl)) referenced.add(m.imageUrl);
await mongoose.disconnect();

const orphans = findOrphans(objects, referenced);
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
console.log(`Bucket: ${BUCKET} (${FOLDERS.join(", ")})`);
console.log(apply ? "APPLYING CHANGES\n" : "DRY RUN (nothing will change)\n");
console.log(`  files in the app's folders   ${objects.length}`);
console.log(`  still used by the database   ${objects.filter((o) => referenced.has(o.key)).length}`);
console.log(`  orphans to delete            ${orphans.length} (${mb(orphans.reduce((n, o) => n + o.size, 0))} MB)\n`);
orphans.slice(0, 50).forEach((o) => console.log(`    ${o.key}`));
if (orphans.length > 50) console.log(`    … and ${orphans.length - 50} more`);

if (orphans.length && apply) {
  fs.mkdirSync("backups", { recursive: true });
  const file = path.join("backups", `s3-orphans-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(orphans, null, 2));
  console.log(`\nList saved to ${file}`);
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += 1000) {
    const batch = orphans.slice(i, i + 1000);
    const res = await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: batch.map((o) => ({ Key: o.key })) } }));
    deleted += res.Deleted?.length ?? 0;
    for (const e of res.Errors ?? []) console.error(`  couldn't delete ${e.Key}: ${e.Message}`);
  }
  console.log(`Deleted ${deleted} file(s).`);
} else if (orphans.length) console.log("\nDry run only. Add --apply to delete.");
