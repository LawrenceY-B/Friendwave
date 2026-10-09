import joi from "joi";
import { pageQuery } from "../lib/validation";

export const searchQuery = joi.object({
  search: joi.string().trim().min(1).max(50).required(),
  ...pageQuery,
});

export const updateProfileBody = joi
  .object({
    name: joi.string().trim().min(1).max(50),
    username: joi
      .string()
      .trim()
      .min(3)
      .max(30)
      .pattern(/^[A-Za-z0-9._]+$/)
      .messages({ "string.pattern.base": "username may only contain letters, numbers, . and _" }),
    bio: joi.string().allow("").max(150),
  });
