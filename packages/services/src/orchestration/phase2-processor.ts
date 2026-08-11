import {
  createExtractedExpense,
  getExpenseReportJobLambda,
  getOcrResultByReceiptId,
  getReceiptFile,
  getSchemaVersion,
  updateReceiptFile,
} from "@repo/db";
import { openaiExtractionService } from "../extraction/openai-extraction.service";
import { buildZodSchema } from "../extraction/extraction-helpers";

function isDuplicateError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("unique constraint") ||
      error.message.includes("uniq_active_receipt"))
  );
}

export async function processPhase2Extraction(
  receiptId: string,
): Promise<void> {
  // Idempotency check
  const receipt = await getReceiptFile(receiptId);
  // TODO: we may need another version of this method that doesn't require userId?
  const job = await getExpenseReportJobLambda(receipt.jobId);
  const schemaVersion = await getSchemaVersion(job.schemaVersionId);

  if (receipt.status === "complete") {
    console.log(`[Phase 2] Receipt ${receiptId} already complete, skipping`);
    return;
  }

  if (!(receipt.status === "ocr_complete" || receipt.status === "extracting")) {
    throw new Error(
      `[Phase 2] Receipt ${receiptId} not ready (status: ${receipt.status})`,
    );
  }

  // Get OCR results
  const ocrResult = await getOcrResultByReceiptId(receiptId);

  if (!ocrResult) {
    throw new Error(`[Phase 2] Receipt ${receiptId} missing OCR results`);
  }

  // Mark as extracting
  await updateReceiptFile(receiptId, {
    status: "extracting",
    extractionStartedAt: new Date(),
  });

  const zodSchemaVersion = buildZodSchema(schemaVersion?.fields ?? []);

  // Run extraction
  const result = await openaiExtractionService.extractFromText(
    ocrResult.extractedText,
    zodSchemaVersion,
  );

  if (!result.success || !result.data) {
    await updateReceiptFile(receiptId, {
      status: "failed",
      errorMessage: `Extraction failed: ${result.error}`,
    });

    if (result.shouldRetry) {
      throw new Error(`Extraction retryable error: ${result.error}`);
    }
    return;
  }

  // Save to database
  const data = result.data;
  const { amount, date, ...extractedFields } = data;

  try {
    await createExtractedExpense({
      receiptId,
      amount: amount.toString(),
      date: date, // TODO: maybe call mapper `normalizeData` -> but maybe not needed because of z.iso.date()
      extractedFields: extractedFields,
      ocrResultId: ocrResult.id,
      modelVersion: "gpt-4o-mini",
      isCurrent: true,
    });
  } catch (error) {
    // Handle duplicate (idempotent)
    if (isDuplicateError(error)) {
      console.log(`[Phase 2] Duplicate extraction for ${receiptId}`);
    } else {
      throw error;
    }
  }

  // Mark complete
  await updateReceiptFile(receiptId, {
    status: "complete",
    extractionCompletedAt: new Date(),
  });
  console.log(`[Phase 2] Extraction complete for ${receiptId}`);
}
