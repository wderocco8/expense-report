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
  uploadReceiptImage,
} from "@/server/services/storage.service";
import { NewReceiptFile, ReceiptFile } from "@repo/db/src/schema";
import { enqueueReceiptProcessing } from "@/server/services/queue.service";

/**
 * Ingests a receipt into the system.
 *
 * Handles image normalization, S3 upload, and DB persistence.
 * Optionally triggers further processing (OCR / AI extraction).
 *
 * @param params - Object containing job ID and the file to ingest
 * @param params.jobId - ID of the expense report job
 * @param params.file - Receipt file to ingest
 * @returns The created ReceiptFile record
 */
export async function ingestReceipt({
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

  await uploadReceiptImage({
    buffer,
    contentType,
    key,
  });

  const receipt = await createReceiptFile({
    jobId,
    originalFilename: file.name,
    s3Key: key,
  });

  // NOTE: process receipts asynchronously (no await keyword)
  // processReceipt(receipt.id);
  await enqueueReceiptProcessing(receipt.id);
}

/**
 * Persists a new ReceiptFile record to the database.
 *
 * @param data - Data for the new receipt file
 * @returns The created ReceiptFile record
 */
export async function createReceiptFile(
  data: NewReceiptFile,
): Promise<ReceiptFile> {
  const job = await reopCreateReceiptFile(data);
  return job;
}

export async function updateReceiptFile(
  id: string,
  data: ReceiptFileUpdateInput,
): Promise<ReceiptFile> {
  const receipt = await repoUpdateReceiptFile(id, data);
  return receipt;
}

/**
 * Retrieves a ReceiptFile by its ID.
 *
 * @param id - ID of the receipt file to retrieve
 * @returns The matching ReceiptFile record
 * @throws If no receipt file with the given ID exists
 */
export async function getReceiptFile(id: string): Promise<ReceiptFile> {
  return repoGetReceiptFile(id);
}

export async function getReceiptFileWithJob(id: string) {
  return repoGetReceiptFileWithJob(id);
}

export async function getReceiptFileWithExpense(
  id: string,
): Promise<ReceiptFile> {
  return repoGetReceiptFile(id);
}

/**
 * Deletes a receipt file from the database and its associated S3 object
 * @param id - ID of the receipt file to delete
 * @returns The deleted ReceiptFile record
 */
export async function deleteReceiptFileWithS3(
  id: string,
): Promise<ReceiptFile | null> {
  // First, get the receipt to know its S3 key
  const receipt = await repoGetReceiptFile(id);

  // Delete the S3 object
  try {
    await deleteS3Object(receipt.s3Key);
  } catch (err) {
    console.error("Failed to delete S3 object", err);
    return null;
  }

  // Delete the DB record
  const deleted = await repoDeleteReceiptFile(id);

  return deleted;
}

/**
 * Normalizes a receipt image file for processing and storage.
 *
 * Currently converts HEIC/HEIF images to JPEG.
 * Future enhancements could include resizing, compression, or orientation fixes.
 *
 * @internal
 * @param file - The file to normalize
 * @returns The normalized File
 */
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

  // Resize files
  // const resized = await sharp(file.arrayBuffer())
  //   .resize({ width: 768 }) // or even 512 for receipts
  //   .jpeg({ quality: 80 })
  //   .toBuffer();

  return file;
}

/**
 * Prepares a receipt image file for upload.
 *
 * Converts the File to a Buffer, determines content type, and generates a
 * unique storage key scoped to the expense report job.
 *
 * @internal
 * @param params - Object containing the file and job ID
 * @param params.file - The file to upload
 * @param params.jobId - The job ID used to scope the storage key
 * @returns Object containing buffer, content type, and key for S3 upload
 */
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
  const contentType = file.type;

  return { buffer, contentType, key };
}
