import { Request } from "express";
import joi from "joi"

export const validateFollow = (person:Request) => {
    const schema = joi.object({
      FollowingID: joi.string().min(3),
     
    });
    return schema.validate(person);
  };

  export const validateBio=(bio:Request) => {
    const schema = joi.object({
      Bio: joi.string().min(3),
     
    });
    return schema.validate(bio);
  }