import {
  createExtractedExpense,
  getReceiptFile,
  updateReceiptFile,
} from "@repo/db";

import { getObjectBuffer } from "./storage.service";
import { extractReceiptFromImage } from "./ocr.service";
import { mapReceiptToDb } from "@repo/shared";

export async function processReceipt(receiptId: string): Promise<void> {
  // check if already processed (idempotency check)
  const idemReceipt = await getReceiptFile(receiptId);

  // Note: We intentionally allow reprocessing of "processing" status receipts.
  // SQS visibility timeout ensures only one Lambda processes a receipt at a time.
  // If a Lambda times out, the receipt will be stuck in "processing" state,
  // so we need to allow retries to avoid stuck receipts.
  if (idemReceipt.status === "complete") {
    console.log(`Receipt ${receiptId} already ${idemReceipt.status}, skipping`);
    return;
  }

  // update status and get receipt
  const receipt = await updateReceiptFile(receiptId, { status: "ocr_processing" });

  // stream file from s3 using s3Key
  const buffer = await getObjectBuffer(receipt.s3Key);

  const extracted = await extractReceiptFromImage(buffer);
  console.log(
    `extracted file for receiptId (${receiptId}): ${extracted.data?.amount} ${extracted.data?.category} ${extracted.data?.date} ${extracted.data?.description} ${extracted.data?.merchant} ${extracted.data?.transportDetails}`,
  );

  if (!extracted.success || !extracted.data) {
    console.error(`Failed to extract receipt ${receiptId}: ${extracted.error}`);
    await updateReceiptFile(receiptId, {
      status: "failed",
      errorMessage: `Failed to extract receipt ${receiptId}: ${extracted.error}`,
    });
    return;
  }

  const dbRecord = mapReceiptToDb(extracted.data, receiptId);

  try {
    await createExtractedExpense(dbRecord);
  } catch (error) {
    // Check if this is a duplicate insert (unique constraint violation)
    if (
      error instanceof Error &&
      (error.message.includes("unique constraint") ||
        error.message.includes("uniq_active_receipt") ||
        error.message.includes("duplicate"))
    ) {
      console.log(
        `[processReceipt] Receipt ${receiptId} already has an extracted expense (likely duplicate processing). Marking as complete.`,
      );
    } else {
      // Re-throw other errors to be handled by caller
      throw error;
    }
  }

  // update status and get receipt
  await updateReceiptFile(receiptId, { status: "complete" });
}
