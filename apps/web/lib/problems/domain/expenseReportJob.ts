import { problem } from "@/lib/problems/problem";

export const expenseReportJobProblems = {
  notFoundById: (id: string) =>
    problem(
      404,
      "/problems/expense-report-job/not-found",
      "Expense report job not found",
      `No current expense report job exists with ${id}`,
    ),
};
