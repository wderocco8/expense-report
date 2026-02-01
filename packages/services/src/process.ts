import {
  createExtractedExpense,
  getReceiptFile,
  NewExtractedExpense,
  updateReceiptFile,
} from "@repo/db";
import { ReceiptDTO } from "@repo/shared";

import { getObjectBuffer } from "./storage.service";
import { extractReceiptFromImage } from "./ocr.service";

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

function mapReceiptToDb(
  receipt: ReceiptDTO,
  receiptId: string,
): NewExtractedExpense {
  return {
    receiptId,
    merchant: receipt.merchant ?? null,
    description: receipt.description ?? null,
    date: normalizeDate(receipt.date),
    amount: receipt.amount.toString(),
    category: receipt.category,
    transportDetails:
      receipt.category === "transport" ? receipt.transportDetails : null,
    rawJson: receipt, // store raw OCR output
    modelVersion: "gpt-4o-mini", // or from config
    isCurrent: true,
  };
}

function normalizeDate(dateStr: string): string | null {
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return null; // fallback to null if unfixable

  const d = new Date(parsed);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
