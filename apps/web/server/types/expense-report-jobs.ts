import {
  getExpenseReportJobsWithProgress,
  getExpenseReportJobWithFiles,
  getExpenseReportJobWithReceiptAndExpense,
} from "@repo/db";

export type ExpenseReportWithFiles = Awaited<
  ReturnType<typeof getExpenseReportJobWithFiles>
>;

export type ReceiptFileWithExpenses =
  ExpenseReportWithFiles["receiptFiles"][number];

export type ExpenseReportWithReceiptAndExpense = Awaited<
  ReturnType<typeof getExpenseReportJobWithReceiptAndExpense>
>;

export type ExpenseReportJobsWithProgress = Awaited<
  ReturnType<typeof getExpenseReportJobsWithProgress>
>;
