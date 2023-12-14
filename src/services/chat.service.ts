import joi from "joi";
import { Request } from "express";

export const validateChat = (data: Request) => {
    const schema = joi.object({
       senderID: joi.string().min(6).required(),
       receiverID: joi.string().min(6).required(),
    });
    return schema.validate(data);
}