import {Router} from "express";
import { verifyToken } from "../middleware/isAuthorized";
import { addtoStory, deleteStory, getStory } from "../controllers/story";

const StoryRoutes = Router();

StoryRoutes.post('/addstory',verifyToken, addtoStory)
StoryRoutes.delete('/deletestory',verifyToken, deleteStory)
StoryRoutes.get('/getstory',verifyToken, getStory)


export default StoryRoutes;