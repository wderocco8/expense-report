import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  ...(process.env.S3_ENDPOINT
    ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
    : {}),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

const S3_BUCKET = process.env.S3_BUCKET!;

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function downloadS3Object(key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );
  return streamToBuffer(res.Body as Readable);
}

export async function uploadS3Object(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}
