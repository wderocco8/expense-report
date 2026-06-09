import {
  createReceiptFile as reopCreateReceiptFile,
  updateReceiptFile as repoUpdateReceiptFile,
  getReceiptFile as repoGetReceiptFile,
  getReceiptFileWithJob as repoGetReceiptFileWithJob,
  deleteReceiptFile as repoDeleteReceiptFile,
} from "@repo/db";

import { ReceiptFileUpdateInput } from "@repo/shared";

import heicConvert from "heic-convert";
import {
  deleteS3Object,
  generatePresignedPutUrl,
  uploadReceiptImage,
} from "@/server/services/storage.service";
import { NewReceiptFile, ReceiptFile } from "@repo/db/src/schema";
import { receiptFileProblems } from "@/lib/problems/domain/receiptFile";

// ---------------------------------------------------------------------------
// Presigned upload flow (scan receipts)
// ---------------------------------------------------------------------------

// TODO: how does
export async function presignReceiptUploads(
  jobId: string,
  files: { id: string; name: string; type: string }[],
): Promise<{ receiptId: string; presignedUrl: string }[]> {
  return Promise.all(
    files.map(async (file) => {
      const id = file.id;
      const s3Key = `receipts/${jobId}/${id}`;

      await reopCreateReceiptFile({
        id,
        jobId,
        s3Key,
        originalFilename: file.name,
      });

      const presignedUrl = await generatePresignedPutUrl(s3Key, file.type);

      return { receiptId: id, presignedUrl };
    }),
  );
}

// ---------------------------------------------------------------------------
// Manual upload flow (single file, goes through Vercel — kept for manual tab)
// ---------------------------------------------------------------------------

export async function persistReceiptFile({
  jobId,
  file,
}: {
  jobId: string;
  file: File;
}) {
  const normalized = await normalizeReceiptImage(file);
  const { buffer, contentType, key } = await buildReceiptUpload({
    file: normalized,
    jobId,
  });

  await uploadReceiptImage({ buffer, contentType, key });

  return key;
}

export async function createReceiptFile(
  data: NewReceiptFile,
): Promise<ReceiptFile> {
  return reopCreateReceiptFile(data);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export async function updateReceiptFile(
  id: string,
  data: ReceiptFileUpdateInput,
): Promise<ReceiptFile> {
  const receipt = await repoUpdateReceiptFile(id, data);

  if (!receipt) {
    throw receiptFileProblems.notFoundById(id);
  }

  return receipt;
}

export async function getReceiptFile(id: string): Promise<ReceiptFile> {
  const receipt = repoGetReceiptFile(id);

  if (!receipt) {
    throw receiptFileProblems.notFoundById(id);
  }

  return receipt;
}

export async function getReceiptFileWithJob(id: string) {
  const receipt = await repoGetReceiptFileWithJob(id);

  if (!receipt) {
    throw receiptFileProblems.notFoundById(id);
  }

  return receipt;
}

export async function getReceiptFileWithExpense(
  id: string,
): Promise<ReceiptFile> {
  const receipt = repoGetReceiptFile(id);

  if (!receipt) {
    throw receiptFileProblems.notFoundById(id);
  }

  return receipt;
}

export async function deleteReceiptFileWithS3(
  id: string,
): Promise<ReceiptFile> {
  const receipt = await repoGetReceiptFile(id);

  if (!receipt) {
    throw receiptFileProblems.notFoundById(id);
  }

  const deleted = await repoDeleteReceiptFile(id);

  deleteS3Object(receipt.s3Key).catch((err) => {
    console.error("S3 cleanup failed for receipt", id, err);
  });

  return deleted;
}

// ---------------------------------------------------------------------------
// Internal — manual upload only
// ---------------------------------------------------------------------------

async function normalizeReceiptImage(file: File) {
  if (["image/heic", "image/heif"].includes(file.type)) {
    const arrayBuffer = Buffer.from(await file.arrayBuffer());
    const uint8 = new Uint8Array(arrayBuffer);

    const jpegBuffer = await heicConvert({
      buffer: uint8 as unknown as ArrayBuffer,
      format: "JPEG",
      quality: 0.8,
    });

    return new File([jpegBuffer], file.name.replace(/\.heic$/i, ".jpg"), {
      type: "image/jpeg",
    });
  }

  return file;
}

async function buildReceiptUpload({
  file,
  jobId,
}: {
  file: File;
  jobId: string;
}) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "img";
  const key = `receipts/${jobId}/${crypto.randomUUID()}.${extension}`;

  return { buffer, contentType: file.type, key };
}
