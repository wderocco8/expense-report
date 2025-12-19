import {
  ExtractedExpense,
  extractedExpenses,
  NewExtractedExpense,
} from "@/server/db/schema";
import { db } from "@/server/db/client";

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
