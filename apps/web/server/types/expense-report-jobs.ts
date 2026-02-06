import {
  getExpenseReportJobsWithProgress,
  getExpenseReportJobWithFiles,
  getExpenseReportJobWithReceiptAndExpense,
} from "@repo/db";

export type ExpenseReportWithFiles = NonNullable<
  Awaited<ReturnType<typeof getExpenseReportJobWithFiles>>
>;

export type ReceiptFileWithExpenses =
  ExpenseReportWithFiles["receiptFiles"][number];

export type ExpenseReportWithReceiptAndExpense = NonNullable<
  Awaited<ReturnType<typeof getExpenseReportJobWithReceiptAndExpense>>
>;

export type ExpenseReportJobsWithProgress = Awaited<
  ReturnType<typeof getExpenseReportJobsWithProgress>
>;
