import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextFunction, Request } from "express";
import joi from "joi";
import { Schema } from "mongoose";
import { environment } from "../environments/endpoints.config";

export const validatePost = (caption: Request) => {
  const schema = joi.object({
    caption: joi.string().min(0).max(250),
  });
  return schema.validate(caption);
};
export const validatePostID = (caption: Request) => {
    const schema = joi.object({
      postID: joi.string().min(6),
    });
    return schema.validate(caption);
  };
  export const validateCommentID = (caption: Request) => {
    const schema = joi.object({
      commentId: joi.string().min(6),
    });
    return schema.validate(caption);
  };

export const validateReply = (caption: Request) => {
  const schema = joi.object({
    commentID: joi.string().min(6),
    message: joi.string().min(0).max(250),
  });
  return schema.validate(caption);
};
export const validateComment = (caption: Request) => {
  const schema= joi .object({
    message:joi.string().min(0).max(250),
    postID:joi.string().min(6),
  });
  return schema.validate(caption);
}


export const ImageUpload = async (
    images: Express.Multer.File[],
    next: NextFunction,
    userid: Schema.Types.ObjectId
  ) => {
    try {
      const awsS3 = new S3Client({
        credentials: {
          accessKeyId: environment.AWS_ACCESS_KEY,
          secretAccessKey: environment.AWS_SECRET_ACCESS_KEY,
        },
        region: "eu-west-2",
      });
  
      const uploadPromises = images.map(async (element) => {
        try {
          const MIMEtype = element.mimetype;
          const fileformat = MIMEtype.replace(MIMEtype.slice(0, 6), ".");
          const key = `/posts/${userid}${Date.now().toString()}${fileformat}`;
  
          const upload = new PutObjectCommand({
            Bucket: "fwstorage-trial",
            Key: key,
            Body: element.buffer,
          });
          await awsS3.send(upload);
  
          // Generate a signed URL for the uploaded object
          const signedUrl = await getSignedUrl(awsS3, new GetObjectCommand({
            Bucket: "fwstorage-trial",
            Key: key,
          }));
  
          return signedUrl;
        } catch (error) {
            next(error);
        }
      });
  
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (err) {
      next(err);
    }
  };
