import {
  S3,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextFunction, Request } from "express";
import joi from "joi";
import { Schema } from "mongoose";
import { environment } from "../environments/endpoints.config";

export const validateFollow = (person: Request) => {
  const schema = joi.object({
    FollowingID: joi.string().min(3),
  });
  return schema.validate(person);
};

export const validateBio = (bio: Request) => {
  const schema = joi.object({
    Bio: joi.string().min(3),
  });
  return schema.validate(bio);
};
export const validateProfile = (profile: Request) => {
  const schema = joi.object({
    Name: joi.string().min(3),
    Username: joi.string().min(3),
    Bio: joi.string().min(0).max(150),
  });
  return schema.validate(profile);
};
export const ImageUpload = async (
  images: Express.Multer.File,
  next: NextFunction,
  userid: Schema.Types.ObjectId
) => {
  try {
    let MIMEtype = images.mimetype;
    const fileformat = MIMEtype.replace(MIMEtype.slice(0, 6), ".");
    const awsS3 = new S3Client({
      credentials: {
        accessKeyId: `${environment.AWS_ACCESS_KEY}`,
        secretAccessKey: `${environment.AWS_SECRET_ACCESS_KEY}`,
      },
      region: "eu-west-2",
    });
    const key = `/profile/${userid}${Date.now().toString()}${fileformat}`;
    let upload = new PutObjectCommand({
      Bucket: "fwstorage-trial",
      Key: `${key}`,
      Body: images.buffer,
    });
    await awsS3.send(upload);

    let retrieve = new GetObjectCommand({
      Bucket: "fwstorage-trial",
      Key: `${key}`,
    });
    const signedUrl = await getSignedUrl(awsS3, retrieve);
    return signedUrl;
  } catch (err) {
    next(err);
  }
};
