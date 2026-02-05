import { extractedExpenseProblems } from "@/lib/problems/domain/extractedExpense";
import {
  createExtractedExpense as repoCreateExtractedExpense,
  getCurrentExtractedExpenseForReceipt as repoGetCurrentExtractedExpenseForReceipt,
  updateExtractedExpense as repoUpdateExtractedExpense,
  type ExtractedExpense,
  type NewExtractedExpense,
} from "@repo/db";

import { ExtractedExpenseUpdateInput } from "@repo/shared";

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
  data: NewExtractedExpense,
): Promise<ExtractedExpense> {
  const expense = await repoCreateExtractedExpense(data);
  return expense;
}

export async function getCurrentExtractedExpenseForReceipt(
  receiptId: string,
): Promise<ExtractedExpense> {
  const expense = await repoGetCurrentExtractedExpenseForReceipt(receiptId);

  if (!expense) {
    throw extractedExpenseProblems.notFoundByReceipt(receiptId);
  }

  return expense;
}

export async function updateExtractedExpense(
  expenseId: string,
  data: ExtractedExpenseUpdateInput,
): Promise<ExtractedExpense> {
  const expense = await repoUpdateExtractedExpense(expenseId, data);

  if (!expense) {
    throw extractedExpenseProblems.notFoundById(expenseId);
  }

  return expense;
}
