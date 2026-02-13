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

  if (
    idemReceipt.status === "complete" ||
    idemReceipt.status === "processing"
  ) {
    console.log(`Receipt ${receiptId} already ${idemReceipt.status}, skipping`);
    return;
  }

  // update status and get receipt
  const receipt = await updateReceiptFile(receiptId, { status: "processing" });

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
  await createExtractedExpense(dbRecord);

  // update status and get receipt
  await updateReceiptFile(receiptId, { status: "complete" });
}
