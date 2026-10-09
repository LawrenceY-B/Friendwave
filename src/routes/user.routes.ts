import { Router } from "express";
import upload from "../middleware/upload";
import { validate } from "../middleware/validate";
import { idParams, pageOnly } from "../lib/validation";
import { searchQuery, updateProfileBody } from "../services/user.service";
import {
  follow, getFollowers, getFollowing, getMe, getSavedPosts, getUser, getUserPosts,
  removeFollower, searchUsers, unfollow, updateMe,
} from "../controllers/user";

const UserRoutes = Router();

UserRoutes.get("/", validate({ query: searchQuery }), searchUsers);

// "/me" routes come before "/:id" so "me" isn't treated as an id
UserRoutes.get("/me", getMe);
UserRoutes.patch("/me", upload.single("avatar"), validate({ body: updateProfileBody }), updateMe);
UserRoutes.get("/me/saved", validate({ query: pageOnly }), getSavedPosts);
UserRoutes.delete("/me/followers/:id", validate({ params: idParams }), removeFollower);

UserRoutes.get("/:id", validate({ params: idParams }), getUser);
UserRoutes.get("/:id/posts", validate({ params: idParams, query: pageOnly }), getUserPosts);
UserRoutes.get("/:id/followers", validate({ params: idParams, query: pageOnly }), getFollowers);
UserRoutes.get("/:id/following", validate({ params: idParams, query: pageOnly }), getFollowing);
UserRoutes.post("/:id/follow", validate({ params: idParams }), follow);
UserRoutes.delete("/:id/follow", validate({ params: idParams }), unfollow);

export default UserRoutes
