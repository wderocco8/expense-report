import { createOcrResult, getReceiptFile, updateReceiptFile } from "@repo/db";
import { textractService } from "../ocr/textract.service";

export async function processPhase1Ocr(receiptId: string): Promise<void> {
  // Idempotency check
  const receipt = await getReceiptFile(receiptId);

  // TODO: future updates *may* allow re-processing
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

  // Mark as processing
  await updateReceiptFile(receiptId, {
    status: "ocr_processing",
    ocrStartedAt: new Date(),
  });

  // Run Textract
  const result = await textractService.extractText(receipt.s3Key);

  if (!result.success || !result.data) {
    await updateReceiptFile(receiptId, {
      status: "failed",
      errorMessage: `OCR failed: ${result.error}`,
    });

    // TODO: maybe implement retry + backoff
    if (result.shouldRetry) {
      throw new Error(`Textract retryable error: ${result.error}`);
    }
    return;
  }

  // Store in audit table
  const ocrResult = await createOcrResult({
    receiptId,
    provider: "textract",
    extractedText: result.data,
    confidence: result.avgConfidence.toString(),
  });

  // Update receipt status
  await updateReceiptFile(receiptId, {
    status: "ocr_complete",
    ocrCompletedAt: new Date(),
    ocrProvider: "textract",
  });

  console.log(
    `[Phase 1] OCR complete for ${receiptId}, result ID: ${ocrResult.id}`,
  );
}
