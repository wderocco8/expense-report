import {
  getExpenseReportJobWithFiles,
  getExpenseReportJobWithReceiptAndExpense,
} from "@/server/repositories/expenseReports.repo";

export type ExpenseReportWithFiles = Awaited<
  ReturnType<typeof getExpenseReportJobWithFiles>
>;

export type ReceiptFileWithExpenses =
  ExpenseReportWithFiles["receiptFiles"][number];

export type ExpenseReportWithReceiptAndExpense = Awaited<
  ReturnType<typeof getExpenseReportJobWithReceiptAndExpense>
>;
