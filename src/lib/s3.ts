import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { environment } from "../environments/endpoints.config";

// One client for the whole app; creating a new one per upload is wasteful.
const s3 = new S3Client({
  credentials: {
    accessKeyId: environment.AWS_ACCESS_KEY,
    secretAccessKey: environment.AWS_SECRET_ACCESS_KEY,
  },
  region: environment.AWS_REGION,
});

export const MEDIA_FOLDERS = ["posts", "profile"] as const;
type MediaFolder = (typeof MEDIA_FOLDERS)[number];

// Uploads a file and returns its S3 key (e.g. "posts/<user>/<uuid>.jpeg").
// We store the key, not a URL: signed URLs expire, keys don't.
// Errors are thrown, so the calling controller decides what to send back.
const uploadImage = async (
  file: Express.Multer.File,
  folder: MediaFolder,
  userId: string
) => {
  const extension = file.mimetype.split("/")[1];
  const key = `${folder}/${userId}/${randomUUID()}.${extension}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: environment.AWS_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );
  return key;
};

const deleteImages = async (keys: string[]) => {
  // Old documents may still hold full (expired) URLs; only delete real keys.
  const objects = keys
    .filter((key) => !key.startsWith("http"))
    .map((Key) => ({ Key }));
  if (objects.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: environment.AWS_BUCKET,
      Delete: { Objects: objects },
    })
  );
};

const signedUrl = (key: string) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: environment.AWS_BUCKET, Key: key }),
    { expiresIn: 60 * 60 }
  );

// Grouped in one object so tests can swap in fakes (no real S3 calls in tests)
export const storage = { uploadImage, deleteImages, signedUrl };

// Turns a stored key into the public URL of our media route. Values that are
// already URLs (e.g. Auth0 profile pictures) are returned unchanged.
export const mediaUrl = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return `${environment.API_URL}/api/media/${value}`;
};
