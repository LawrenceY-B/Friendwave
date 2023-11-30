import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { addtoStory, deleteStory } from "../controllers/story";

const StoryRoutes = Router();

StoryRoutes.post('/addstory',verifyToken, addtoStory)
StoryRoutes.delete('/deletestory',verifyToken, deleteStory)


export default StoryRoutes;