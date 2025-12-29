import {
  ExtractedExpense,
  extractedExpenses,
  NewExtractedExpense,
} from "@/server/db/schema/app.schema";
import { db } from "@/server/db/client";
import { ExtractedExpenseUpdateInput } from "@/server/validators/extractedExpense.zod";
import { and, eq } from "drizzle-orm";

export async function createExtractedExpense(
  data: NewExtractedExpense
): Promise<ExtractedExpense> {
  const [expense] = await db.insert(extractedExpenses).values(data).returning();

  if (!expense) {
    throw new Error("Failed to create extracted expense");
  }

  return expense;
}

export async function getCurrentExtractedExpenseForReceipt(
  receiptId: string
): Promise<ExtractedExpense> {
  const expense = await db.query.extractedExpenses.findFirst({
    where: and(
      eq(extractedExpenses.receiptId, receiptId),
      eq(extractedExpenses.isCurrent, true)
    ),
  });

  if (!expense) {
    throw new Error(
      `Failed to find current extracted expense for receipt: ${receiptId}`
    );
  }

  return expense;
}

export async function updateExtractedExpense(
  expenseId: string,
  data: ExtractedExpenseUpdateInput
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
