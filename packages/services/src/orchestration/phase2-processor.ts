import {
  createExtractedExpense,
  getOcrResultByReceiptId,
  getReceiptFile,
  updateReceiptFile,
} from "@repo/db";
import { openaiExtractionService } from "../extraction/openai-extraction.service";

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

  // Run extraction
  const result = await openaiExtractionService.extractFromText(
    ocrResult.extractedText,
  );

  if (!result.success) {
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
  const data = result.data!;

  // Map to database format
  const dbRecord = {
    receiptId,
    ocrResultId: ocrResult.id,
    merchant: data.merchant,
    description: data.description,
    date: data.date,
    amount: data.amount.toString(),
    category: data.category,
    transportDetails: data.transportDetails,
    rawJson: data,
    modelVersion: "gpt-4o-mini",
  };

  try {
    await createExtractedExpense(dbRecord);
  } catch (error) {
    // Handle duplicate (idempotent)
    if (isDuplicateError(error)) {
      console.log(`[Phase 2] Duplicate extraction for ${receiptId}`);
    } else {
      throw error;
    }
  }

  // Mark complete
  await updateReceiptFile(receiptId, { status: "complete" });
  console.log(`[Phase 2] Extraction complete for ${receiptId}`);
}
