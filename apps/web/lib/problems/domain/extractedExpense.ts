import { problem } from "@/lib/problems/problem";

export const extractedExpenseProblems = {
  notFoundByReceipt: (receiptId: string) =>
    problem(
      404,
      "/problems/extracted-expense/not-found",
      "Extracted expense not found",
      `No current extracted expense exists for receipt ${receiptId}`,
    ),

  notFoundById: (expenseId: string) =>
    problem(
      404,
      "/problems/extracted-expense/not-found-by-id",
      "Extracted expense not found",
      `No extracted expense exists with id ${expenseId}`,
    ),
};
