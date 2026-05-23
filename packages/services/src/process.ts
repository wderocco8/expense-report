import { getReceiptFile } from "@repo/db";
import { processPhase1Ocr } from "./orchestration/phase1-processor";
import { processPhase2Extraction } from "./orchestration/phase2-processor";

export async function processReceipt(receiptId: string): Promise<void> {
  const receipt = await getReceiptFile(receiptId);

  // Skip if already complete
  // TODO: future updates *may* allow re-processing
  if (receipt.status === "complete") {
    console.log(`[Process] Receipt ${receiptId} already complete`);
    return;
  }

  // Phase 1: OCR (if not done)
  if (receipt.status == "pending") {
    await processPhase1Ocr(receiptId);
  }

  // Re-fetch to get latest status before deciding on Phase 2
  const updated = await getReceiptFile(receiptId);

  // Phase 2: Extraction
  if (updated.status == "ocr_complete" || updated.status == "extracting") {
    await processPhase2Extraction(receiptId);
  }
}
