import { Router } from "express";
import { validate } from "../middleware/validate";
import { idParams } from "../lib/validation";
import { createStoryBody } from "../services/story.service";
import { createStory, deleteStory, getStories } from "../controllers/story";

const StoryRoutes = Router();

StoryRoutes.get("/", getStories);
StoryRoutes.post("/", validate({ body: createStoryBody }), createStory);
StoryRoutes.delete("/:id", validate({ params: idParams }), deleteStory);

export default StoryRoutes;
