// The logic behind scripts/delete-users.mjs, kept separate so it can be tested
// (test/delete-users.test.ts). Works on the raw MongoDB driver (`db`).

const same = (a, b) => a.toLowerCase() === b.toLowerCase(); // usernames are unique ignoring case

// Works out who and what would be deleted, without changing anything.
//   keep:   delete everyone EXCEPT these usernames
//   remove: delete exactly these usernames
export async function planDeletion(db, { keep, remove }) {
  if (!keep === !remove) throw new Error("Give either --keep or --delete (not both)");
  const users = await db.collection("users").find({}, { projection: { Username: 1, Name: 1, ProfileUrl: 1 } }).toArray();
  const names = keep ?? remove;
  const missing = names.filter((n) => !users.some((u) => same(u.Username, n)));
  if (missing.length) throw new Error(`No user named ${missing.join(", ")}. Check the spelling; nothing was deleted.`);

  const listed = (u) => names.some((n) => same(u.Username, n));
  const targets = users.filter((u) => (keep ? !listed(u) : listed(u)));
  const kept = users.filter((u) => !targets.includes(u));
  if (kept.length === 0) throw new Error("That would delete every account; refusing.");

  const ids = targets.map((u) => u._id);
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

  const counts = {};
  for (const [name, filter] of Object.entries(filters)) counts[name] = await db.collection(name).countDocuments(filter);
  for (const [name, edit] of Object.entries(edits)) counts[`${name} removed from others' posts`] = await db.collection(edit.collection).countDocuments(edit.filter);
  const files = posts.reduce((n, p) => n + (p.imageUrl?.length ?? 0), 0) + targets.filter((u) => u.ProfileUrl).length;

  return { targets, kept, filters, edits, counts, files };
}

// Everything the plan touches, for the JSON backup written before --apply
export async function backupFor(db, plan) {
  const backup = {};
  for (const [name, filter] of Object.entries(plan.filters)) backup[name] = await db.collection(name).find(filter).toArray();
  for (const [name, edit] of Object.entries(plan.edits)) backup[`edited:${name}`] = await db.collection(edit.collection).find(edit.filter).toArray();
  return backup;
}

// Carries the plan out. Pass a session to run it inside a transaction.
export async function applyDeletion(db, plan, session) {
  const opts = session ? { session } : {};
  const result = {};
  // Edits first: their filters exclude documents that are about to be deleted
  for (const [name, edit] of Object.entries(plan.edits))
    result[name] = (await db.collection(edit.collection).updateMany(edit.filter, edit.update, opts)).modifiedCount;
  for (const [name, filter] of Object.entries(plan.filters))
    result[name] = (await db.collection(name).deleteMany(filter, opts)).deletedCount;
  return result;
}
