import * as extractedExpensesRepo from "@/server/repositories/extractedExpenses.repo";
import {
  ExtractedExpense,
  NewExtractedExpense,
} from "@/server/db/schema/app.schema";
import { extractReceiptFromImage } from "@/server/services/ocr.service";
import { updateReceiptFile } from "@/server/services/receipts.service";
import { getObjectBuffer } from "@/server/services/storage.service";
import { ReceiptDTO } from "@/server/validators/receipt.zod";
import { ExtractedExpenseUpdateInput } from "../validators/extractedExpense.zod";

// TODO: maybe add this to the updateReceiptFile model?
type ReceiptFailureCode =
  | "ocr_failed"
  | "image_corrupt"
  | "model_error"
  | "storage_error";

/**
 * Persists a new ExtractedExpense record to the database.
 *
 * @param data - Data for the new extracted expense
 * @returns The created ExtractedExpense record
 */
export async function createExtractedExpense(
  data: NewExtractedExpense
): Promise<ExtractedExpense> {
  const expense = await extractedExpensesRepo.createExtractedExpense(data);
  return expense;
}

export async function getCurrentExtractedExpenseForReceipt(
  receiptId: string
): Promise<ExtractedExpense> {
  const expense =
    await extractedExpensesRepo.getCurrentExtractedExpenseForReceipt(receiptId);
  return expense;
}

export async function updateExtractedExpense(
  expenseId: string,
  data: ExtractedExpenseUpdateInput
): Promise<ExtractedExpense> {
  const expense = await extractedExpensesRepo.updateExtractedExpense(
    expenseId,
    data
  );
  return expense;
}

export async function processReceipt(receiptId: string): Promise<void> {
  // update status and get receipt
  const receipt = await updateReceiptFile(receiptId, { status: "processing" });

  // stream file from s3 using s3Key
  const buffer = await getObjectBuffer(receipt.s3Key);

  const extracted = await extractReceiptFromImage(buffer);
  console.log(
    `extracted file for receiptId (${receiptId}): ${extracted.data?.amount} ${extracted.data?.category} ${extracted.data?.date} ${extracted.data?.description} ${extracted.data?.merchant} ${extracted.data?.transportDetails}`
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
  receiptId: string
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
