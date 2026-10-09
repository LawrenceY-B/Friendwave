import { NextFunction, Request, Response, Router } from "express";
import { MEDIA_FOLDERS, storage } from "../lib/s3";

const MediaRoutes = Router();

// GET /api/media/posts/<user>/<file> -> redirects to a short-lived signed S3 URL.
// The bucket stays private, and the link stored in the database never expires.
// This route is public because <img> tags can't send an Authorization header.
MediaRoutes.get("/{*key}", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parts = req.params.key as unknown as string[];
    const key = parts.join("/");
    const allowed = MEDIA_FOLDERS.some((folder) => key.startsWith(`${folder}/`));
    // Check the joined key, so an encoded "..%2F" inside one segment is caught too
    if (!allowed || key.split("/").includes("..")) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const url = await storage.signedUrl(key);
    // Let browsers reuse the redirect for a while (well under the 1h URL lifetime)
    res.set("Cache-Control", "private, max-age=600");
    res.redirect(302, url);
  } catch (error) {
    next(error);
  }
});

export default MediaRoutes;
