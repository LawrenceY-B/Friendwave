import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { addtoStory } from "../controllers/story";

const StoryRoutes = Router();

StoryRoutes.post('/addstory',verifyToken, addtoStory)


export default StoryRoutes;