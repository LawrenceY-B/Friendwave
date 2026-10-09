import joi from "joi";
import { objectId } from "../lib/validation";

export const createStoryBody = joi.object({
  postId: objectId().required(),
});
