import { createOcrResult, getReceiptFile, updateReceiptFile } from "@repo/db";
import { textractService } from "../ocr/textract.service";
import { downloadS3Object, uploadS3Object } from "../storage/s3.service";
import heicConvert from "heic-convert";
import sharp from "sharp";

export async function processPhase1Ocr(receiptId: string): Promise<void> {
  const receipt = await getReceiptFile(receiptId);

  if (["ocr_complete", "complete", "extracting"].includes(receipt.status)) {
    console.log(
      `[Phase 1] Receipt ${receiptId} OCR already complete, skipping`,
    );
    return;
  }

  if (receipt.status === "failed") {
    console.log(
      `[Phase 1] Receipt ${receiptId} previously failed, retrying OCR`,
    );
  }

  await updateReceiptFile(receiptId, {
    status: "ocr_processing",
    ocrStartedAt: new Date(),
  });

  // Normalize: download raw upload, convert HEIC if needed, resize/compress,
  // then overwrite the same S3 key so Textract and the frontend get a clean JPEG.
  try {
    const raw = await downloadS3Object(receipt.s3Key);
    const normalized = await normalizeImage(raw);
    await uploadS3Object(receipt.s3Key, normalized, "image/jpeg");
  } catch (err) {
    await updateReceiptFile(receiptId, {
      status: "failed",
      errorMessage: `Normalization failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // Run Textract against the normalized JPEG now stored at the same key
  const result = await textractService.extractText(receipt.s3Key);

  if (!result.success || !result.data) {
    await updateReceiptFile(receiptId, {
      status: "failed",
      errorMessage: `OCR failed: ${result.error}`,
    });
    return;
  }

  const ocrResult = await createOcrResult({
    receiptId,
    provider: "textract",
    extractedText: result.data,
    confidence: result.avgConfidence.toString(),
  });

  await updateReceiptFile(receiptId, {
    status: "ocr_complete",
    ocrCompletedAt: new Date(),
    ocrProvider: "textract",
  });

  console.log(
    `[Phase 1] OCR complete for ${receiptId}, result ID: ${ocrResult.id}`,
  );
}

async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  let input = buffer;

  if (isHeic(buffer)) {
    const uint8 = new Uint8Array(buffer);
    input = Buffer.from(
      await heicConvert({
        buffer: uint8 as unknown as ArrayBuffer,
        format: "JPEG",
        quality: 0.9,
      }),
    );
  }

  return sharp(input)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// Detects HEIC/HEIF by magic bytes: 'ftyp' box at offset 4.
function isHeic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return ["heic", "heix", "mif1", "msf1", "hevc", "hevx"].includes(brand);
}
