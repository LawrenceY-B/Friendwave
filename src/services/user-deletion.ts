import mongoose from "mongoose";

// Deleting accounts and everything that belongs to them. Used by DELETE /api/users/me
// (deleting your own account) and by scripts/delete-users.mjs (admin clean-ups).
// Works on the raw MongoDB driver, so it sees every document whatever the models say.

type Db = mongoose.mongo.Db;
type ObjectId = mongoose.Types.ObjectId;
type Doc = Record<string, any>;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase(); // usernames are unique ignoring case
const isKey = (value: unknown): value is string => typeof value === "string" && value.length > 0 && !value.startsWith("http");

export interface DeletionPlan {
  targets: Doc[];
  kept: Doc[];
  filters: Record<string, Doc>;
  edits: Record<string, { filter: Doc; update: Doc; collection: string }>;
  counts: Record<string, number>;
  mediaKeys: string[]; // S3 files of theirs: post photos, profile picture, chat photos
}

export interface DeletionTarget {
  keep?: string[]; // delete everyone EXCEPT these usernames
  remove?: string[]; // delete exactly these usernames
  all?: boolean; // delete every account (must be asked for explicitly)
  userIds?: string[]; // delete these accounts by id (deleting your own account)
}

// Works out who and what would be deleted, without changing anything
export async function planDeletion(db: Db, { keep, remove, all = false, userIds }: DeletionTarget): Promise<DeletionPlan> {
  if ([keep, remove, all || undefined, userIds].filter(Boolean).length !== 1)
    throw new Error("Give exactly one of --keep, --delete or --all");
  const users = await db.collection("users").find({}, { projection: { Username: 1, Name: 1, ProfileUrl: 1 } }).toArray();
  const names = keep ?? remove ?? [];
  const missing = names.filter((n) => !users.some((u) => same(u.Username, n)));
  if (missing.length) throw new Error(`No user named ${missing.join(", ")}. Check the spelling; nothing was deleted.`);

  const listed = (u: Doc) => names.some((n) => same(u.Username, n));
  const targets = userIds
    ? users.filter((u) => userIds.includes(String(u._id)))
    : all
      ? users
      : users.filter((u) => (keep ? !listed(u) : listed(u)));
  const kept = users.filter((u) => !targets.includes(u));
  if (kept.length === 0 && !all && !userIds)
    throw new Error("That would delete every account; use --all if that's really what you want.");

  const ids = targets.map((u) => u._id as ObjectId);
  const idStrings = ids.map(String);
  const posts = await db.collection("posts").find({ userId: { $in: ids } }, { projection: { imageUrl: 1 } }).toArray();
  const postIds = posts.map((p) => p._id);
  const chats = await db.collection("chats").find({ members: { $in: ids } }, { projection: { _id: 1 } }).toArray();
  const chatIds = chats.map((c) => c._id);

  // What goes, collection by collection (also used for the backup)
  const filters = {
    users: { _id: { $in: ids } },
    posts: { _id: { $in: postIds } },
    comments: { $or: [{ userId: { $in: ids } }, { postId: { $in: postIds } }] },
    savedposts: { $or: [{ userId: { $in: ids } }, { postId: { $in: postIds } }] },
    stories: { $or: [{ userId: { $in: ids } }, { postId: { $in: postIds } }] },
    followings: { $or: [{ userID: { $in: ids } }, { followingID: { $in: ids } }] },
    chats: { _id: { $in: chatIds } },
    messages: { chatId: { $in: chatIds } },
    notifications: { $or: [{ userId: { $in: ids } }, { actorId: { $in: ids } }, { postId: { $in: postIds } }] },
  };
  // What's edited rather than deleted: their likes and replies on everyone else's things
  const replyUser = { $in: [...idStrings, ...ids] }; // replies stored the id as a string (older ones as an ObjectId)
  const edits = {
    likes: { filter: { _id: { $nin: postIds }, likes: { $in: ids } }, update: { $pull: { likes: { $in: ids } } }, collection: "posts" },
    replies: {
      filter: { postId: { $nin: postIds }, userId: { $nin: ids }, "replies.userId": replyUser },
      update: { $pull: { replies: { userId: replyUser } } },
      collection: "comments",
    },
  };

  const counts: Record<string, number> = {};
  for (const [name, filter] of Object.entries(filters)) counts[name] = await db.collection(name).countDocuments(filter);
  for (const [name, edit] of Object.entries(edits))
    counts[`${name} removed from others' posts`] = await db.collection(edit.collection).countDocuments(edit.filter);

  const chatPhotos = await db
    .collection("messages")
    .find({ chatId: { $in: chatIds }, imageUrl: { $exists: true } }, { projection: { imageUrl: 1 } })
    .toArray();
  const mediaKeys = [
    ...posts.flatMap((p) => p.imageUrl ?? []),
    ...targets.map((u) => u.ProfileUrl),
    ...chatPhotos.map((m) => m.imageUrl),
  ].filter(isKey);

  return { targets, kept, filters, edits, counts, mediaKeys };
}

// Everything the plan touches, for a JSON backup before deleting
export async function backupFor(db: Db, plan: DeletionPlan) {
  const backup: Record<string, unknown[]> = {};
  for (const [name, filter] of Object.entries(plan.filters)) backup[name] = await db.collection(name).find(filter).toArray();
  for (const [name, edit] of Object.entries(plan.edits))
    backup[`edited:${name}`] = await db.collection(edit.collection).find(edit.filter).toArray();
  return backup;
}

// Carries the plan out. Pass a session to run it inside a transaction.
export async function applyDeletion(db: Db, plan: DeletionPlan, session?: mongoose.mongo.ClientSession) {
  const opts = session ? { session } : {};
  const result: Record<string, number> = {};
  // Edits first: their filters exclude documents that are about to be deleted
  for (const [name, edit] of Object.entries(plan.edits))
    result[name] = (await db.collection(edit.collection).updateMany(edit.filter, edit.update, opts)).modifiedCount;
  for (const [name, filter] of Object.entries(plan.filters))
    result[name] = (await db.collection(name).deleteMany(filter, opts)).deletedCount;
  return result;
}

// ---- S3 clean-up (scripts/cleanup-s3.mjs) ----

// Files in the bucket that nothing in the database points to any more. Recent files are
// left alone, so an upload that's still being saved isn't mistaken for an orphan.
export function findOrphans(
  objects: { key: string; lastModified: Date }[],
  referenced: Set<string>,
  { now = new Date(), minAgeMs = 60 * 60 * 1000 } = {}
) {
  return objects.filter((o) => !referenced.has(o.key) && now.getTime() - o.lastModified.getTime() > minAgeMs);
}
