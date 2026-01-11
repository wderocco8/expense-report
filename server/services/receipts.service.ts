import heicConvert from "heic-convert";
import { uploadReceiptImage } from "@/server/services/storage.service";
import { NewReceiptFile, ReceiptFile } from "@/server/db/schema/app.schema";
import * as receiptFilesRepo from "@/server/repositories/receiptFiles.repo";
import { processReceipt } from "@/server/services/extractedExpenses.service";
import { ReceiptFileUpdateInput } from "@/server/validators/receipt.zod";

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
  processReceipt(receipt.id);
}

/**
 * Persists a new ReceiptFile record to the database.
 *
 * @param data - Data for the new receipt file
 * @returns The created ReceiptFile record
 */
export async function createReceiptFile(
  data: NewReceiptFile
): Promise<ReceiptFile> {
  const job = await receiptFilesRepo.createReceiptFile(data);
  return job;
}

export async function updateReceiptFile(
  id: string,
  data: ReceiptFileUpdateInput
): Promise<ReceiptFile> {
  const receipt = await receiptFilesRepo.updateReceiptFile(id, data);
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
  return receiptFilesRepo.getReceiptFile(id);
}

export async function getReceiptFileWithJob(id: string) {
  return receiptFilesRepo.getReceiptFileWithJob(id);
}

export async function getReceiptFileWithExpense(
  id: string
): Promise<ReceiptFile> {
  return receiptFilesRepo.getReceiptFile(id);
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
