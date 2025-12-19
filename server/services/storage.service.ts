// server/services/storage.service.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

const S3_BUCKET = process.env.S3_BUCKET;
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;

const s3 = new S3Client({
  region: S3_REGION!,
  endpoint: S3_ENDPOINT,
  forcePathStyle: !!S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY!,
    secretAccessKey: S3_SECRET_KEY!,
  },
});

export async function uploadReceiptImage({
  buffer,
  contentType,
  key,
}: {
  buffer: Buffer;
  contentType: string;
  key: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export function getPublicObjectUrl(key: string) {
  if (S3_ENDPOINT) {
    // MinIO / local
    return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  }

  // AWS S3
  return `https://${S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );

  if (!res.Body) {
    throw new Error(`S3 object body is empty for key: ${key}`);
  }

  return streamToBuffer(res.Body as Readable);
}

// TODO: look into this
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// import { GetObjectCommand } from "@aws-sdk/client-s3";

// export async function getSignedReceiptUrl(key: string) {
//   return getSignedUrl(
//     s3,
//     new GetObjectCommand({
//       Bucket: process.env.S3_BUCKET!,
//       Key: key,
//     }),
//     { expiresIn: 60 * 5 }
//   );
// }
