import {
  ExtractedExpense,
  extractedExpenses,
  NewExtractedExpense,
} from "../schema";
import { db } from "../client";
import { ExtractedExpenseUpdateInput } from "@repo/shared";
import { and, eq } from "drizzle-orm";

export async function createExtractedExpense(
  data: NewExtractedExpense,
): Promise<ExtractedExpense> {
  const [expense] = await db.insert(extractedExpenses).values(data).returning();

  if (!expense) {
    throw new Error("Failed to create extracted expense");
  }

  return expense;
}

export async function getCurrentExtractedExpenseForReceipt(
  receiptId: string,
): Promise<ExtractedExpense | undefined> {
  return db.query.extractedExpenses.findFirst({
    where: and(
      eq(extractedExpenses.receiptId, receiptId),
      eq(extractedExpenses.isCurrent, true),
    ),
  });
}

export async function updateExtractedExpense(
  expenseId: string,
  data: ExtractedExpenseUpdateInput,
): Promise<ExtractedExpense> {
  const [expense] = await db
    .update(extractedExpenses)
    .set({ ...data })
    .where(eq(extractedExpenses.id, expenseId))
    .returning();

  if (!expense) {
    throw new Error("Failed to update extracted expense");
  }

  return expense;
}
