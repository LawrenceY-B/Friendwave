import { NextFunction, Request } from "express";
import joi from "joi";

export const validateStory = (details: Request) => {
  const schema = joi.object({
    postID: joi.string().min(6),
  });
  return schema.validate(details);
};