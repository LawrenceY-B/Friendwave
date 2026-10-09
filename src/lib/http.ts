import { Request, Response } from "express";
import { Types } from "mongoose";

// Throw one of these from a controller and the error handler turns it into
// { success: false, message } with the right status. Express 5 forwards errors
// thrown in async handlers automatically, so no try/catch is needed.
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = "You can't do that") => new HttpError(403, message);
export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const conflict = (message: string) => new HttpError(409, message);

// Every successful response has the same shape: { success: true, data }
export const send = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

// Lists: { success: true, data: [...], nextCursor }. Pass nextCursor back as
// ?cursor= to get the next page; null means there are no more.
export const sendPage = (res: Response, data: unknown[], nextCursor: string | null) =>
  res.status(200).json({ success: true, data, nextCursor });

export interface Page {
  cursor?: Types.ObjectId;
  limit: number;
}

// Reads ?cursor=&limit= (already validated by the route's query schema)
export const pageFrom = (req: Request): Page => {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  return {
    cursor: cursor ? new Types.ObjectId(cursor) : undefined,
    limit: Math.min(Math.max(Number(limit) || 20, 1), 50),
  };
};

// Cursor pagination over _id, newest first. ObjectIds grow over time, so
// "everything older than the last id I saw" is the next page. Unlike
// skip/offset, new items arriving don't shift pages or cause duplicates.
// `find` builds the query (with any populate/select/lean); paginate adds the
// cursor, sort and limit.
export const paginate = async <T extends { _id: unknown }>(
  find: (filter: Record<string, any>) => { sort(s: Record<string, 1 | -1>): { limit(n: number): PromiseLike<T[]> } },
  filter: Record<string, any>,
  { cursor, limit }: Page
) => {
  const query = cursor ? { ...filter, _id: { $lt: cursor } } : filter;
  const docs = await find(query).sort({ _id: -1 }).limit(limit + 1);
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  return { items, nextCursor: hasMore ? String(items[items.length - 1]._id) : null };
};
