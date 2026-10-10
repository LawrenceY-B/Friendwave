import { Request, Response } from "express";
import { randomUUID } from "crypto";
import Post from "../models/post.model";
import Stories from "../models/stories.model";
import Following from "../models/following.model";
import { toUserSummary } from "../lib/dto";
import { notFound, send } from "../lib/http";
import { buildPosts, POST_AUTHOR } from "../services/post.service";
import { notify } from "../services/notification.service";

const STORY_POPULATE = { path: "postId", populate: POST_AUTHOR };

// Shapes stories for the API: one entry per author, oldest story first
// (the order a story viewer plays them in).
const groupByAuthor = async (stories: Record<string, any>[], viewerId: string) => {
  // The post or its author may have been deleted since
  const live = stories.filter((story) => story.postId && story.userId);
  const posts = await buildPosts(live.map((story) => story.postId), viewerId);
  const groups = new Map<string, { author: ReturnType<typeof toUserSummary>; stories: unknown[] }>();
  live.forEach((story, i) => {
    const authorId = String(story.userId._id ?? story.userId);
    if (!groups.has(authorId)) groups.set(authorId, { author: toUserSummary(story.userId), stories: [] });
    groups.get(authorId)!.stories.push({
      id: String(story._id),
      post: posts[i],
      createdAt: story.createdAt,
      expiresAt: story.expireAt,
    });
  });
  return [...groups.values()];
};

// GET /stories. Live stories from you and the people you follow, yours first.
export const getStories = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const following = await Following.find({ userID: me }).distinct("followingID");
  const stories = await Stories.find({
    userId: { $in: [me, ...following] },
    // MongoDB's TTL cleanup runs about once a minute, so filter expired ones too
    expireAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1 })
    .populate({ path: "userId", select: "Username Name ProfileUrl" })
    .populate(STORY_POPULATE)
    .lean();
  const groups = await groupByAuthor(stories, me);
  // Your own stories first, then whoever posted most recently
  const latest = (g: { stories: any[] }) => +new Date(g.stories[g.stories.length - 1].createdAt);
  groups.sort((a, b) => (a.author?.id === me ? -1 : b.author?.id === me ? 1 : latest(b) - latest(a)));
  send(res, groups);
};

// POST /stories  { postId }
export const createStory = async (req: Request, res: Response) => {
  const me = req.user.userID;
  const { postId } = req.body;
  const post = await Post.findById(postId).select("userId").lean();
  if (!post) throw notFound("Post");
  const story = await Stories.create({ userId: me, postId, storyId: randomUUID() });
  // Sharing someone else's post: let them know (never for your own post)
  notify({ recipient: post.userId, actor: me, type: "story_share", postId });
  const populated = await Stories.findById(story._id)
    .populate({ path: "userId", select: "Username Name ProfileUrl" })
    .populate(STORY_POPULATE)
    .lean();
  const [group] = await groupByAuthor([populated!], me);
  send(res, group.stories[0], 201);
};

// DELETE /stories/:id. Your own stories only.
export const deleteStory = async (req: Request, res: Response) => {
  const deleted = await Stories.findOneAndDelete({ _id: String(req.params.id), userId: req.user.userID });
  if (!deleted) throw notFound("Story");
  send(res, null);
};
