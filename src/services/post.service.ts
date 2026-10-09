import joi from "joi";
import { objectId } from "../lib/validation";

export const validatePost = (data: unknown) => {
  const schema = joi.object({
    caption: joi.string().allow("").max(250),
  });
  return schema.validate(data);
};
export const validatePostID = (data: unknown) => {
  const schema = joi.object({
    postID: objectId().required(),
  });
  return schema.validate(data);
};
export const validateCommentID = (data: unknown) => {
  const schema = joi.object({
    commentId: objectId().required(),
  });
  return schema.validate(data);
};

export const validateReply = (data: unknown) => {
  const schema = joi.object({
    commentID: objectId().required(),
    message: joi.string().trim().min(1).max(250).required(),
  });
  return schema.validate(data);
};
export const validateDeleteReply = (data: unknown) => {
  const schema = joi.object({
    commentID: objectId().required(),
    replyID: joi.string().uuid().required(),
  });
  return schema.validate(data);
};
export const validateComment = (data: unknown) => {
  const schema = joi.object({
    message: joi.string().trim().min(1).max(250).required(),
    postID: objectId().required(),
  });
  return schema.validate(data);
};
