import joi from "joi";
import { objectId } from "../lib/validation";

export const validateFollow = (data: unknown) => {
  const schema = joi.object({
    FollowingID: objectId().required(),
  });
  return schema.validate(data);
};

export const validateRemoveFollower = (data: unknown) => {
  const schema = joi.object({
    FollowerID: objectId().required(),
  });
  return schema.validate(data);
};

export const validateBio = (data: unknown) => {
  const schema = joi.object({
    Bio: joi.string().min(3).max(150).required(),
  });
  return schema.validate(data);
};
export const validateProfile = (data: unknown) => {
  const schema = joi.object({
    Name: joi.string().min(3),
    Username: joi.string().min(3),
    Bio: joi.string().allow("").max(150),
  });
  return schema.validate(data);
};

export const validateUserID = (data: unknown) => {
  const schema = joi.object({
    userID: objectId().required(),
  });
  return schema.validate(data);
};

export const validateSearch = (data: unknown) => {
  const schema = joi.object({
    username: joi.string().trim().min(1).max(50).required(),
  });
  return schema.validate(data);
};
