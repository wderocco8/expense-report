import { createOcrResult, getReceiptFile, updateReceiptFile } from "@repo/db";
import { textractService } from "../ocr/textract.service";

export async function processPhase1Ocr(receiptId: string): Promise<void> {
  try {
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
        throw new Error(`Textract ret@deplryable error: ${result.error}`);
      }
      return;
    }

    // Store results
    await updateReceiptFile(receiptId, {
      status: "ocr_complete",
      ocrCompletedAt: new Date(),
      ocrProvider: "textract",
    });

    // Store in audit table
    const ocrResult = await createOcrResult({
      receiptId,
      provider: "textract",
      extractedText: result.data,
      confidence: result.avgConfidence.toString(),
    });

    console.log(
      `[Phase 1] OCR complete for ${receiptId}, result ID: ${ocrResult.id}`,
    );
  } catch (error) {
    console.log("failed here", error);
  }
}
