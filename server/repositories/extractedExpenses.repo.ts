import {
  ExtractedExpense,
  extractedExpenses,
  NewExtractedExpense,
} from "@/server/db/schema";
import { db } from "@/server/db/client";
import { ExtractedExpenseUpdateInput } from "@/server/validators/extractedExpense.zod";
import { eq } from "drizzle-orm";

export async function createExtractedExpense(
  data: NewExtractedExpense
): Promise<ExtractedExpense> {
  const [extractedExpense] = await db
    .insert(extractedExpenses)
    .values(data)
    .returning();

  if (!extractedExpense) {
    throw new Error("Failed to create extracted expense");
  }

  return extractedExpense;
}

export async function updateExtractedExpense(
  expenseId: string,
  data: ExtractedExpenseUpdateInput
): Promise<ExtractedExpense> {
  const [extractedExpense] = await db
    .update(extractedExpenses)
    .set({ ...data })
    .where(eq(extractedExpenses.id, expenseId))
    .returning();

  if (!extractedExpense) {
    throw new Error("Failed to update extracted expense");
  }

  return extractedExpense;
}
