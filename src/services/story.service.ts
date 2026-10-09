import joi from "joi";
import { objectId } from "../lib/validation";

export const validateStory = (data: unknown) => {
  const schema = joi.object({
    postID: objectId().required(),
  });
  return schema.validate(data);
};

export const validateStoryID = (data: unknown) => {
  const schema = joi.object({
    storyId: objectId().required(),
  });
  return schema.validate(data);
};
