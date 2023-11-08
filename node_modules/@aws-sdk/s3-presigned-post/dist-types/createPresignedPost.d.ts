import { S3Client } from "@aws-sdk/client-s3";
import { Conditions as PolicyEntry } from "./types";
type Fields = Record<string, string>;
export interface PresignedPostOptions {
    Bucket: string;
    Key: string;
    Conditions?: PolicyEntry[];
    Fields?: Fields;
    Expires?: number;
}
export interface PresignedPost {
    url: string;
    fields: Fields;
}
/**
 * Builds the url and the form fields used for a presigned s3 post.
 */
export declare const createPresignedPost: (client: S3Client, { Bucket, Key, Conditions, Fields, Expires }: PresignedPostOptions) => Promise<PresignedPost>;
export {};
