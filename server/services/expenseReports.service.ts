import {
  createExpenseReportJob,
  getExpenseReportJobs,
  getExpenseReportJob,
  getExpenseReportJobWithFiles,
  getExpenseReportJobWithReceiptAndExpense,
} from "@/server/repositories/expenseReports.repo";
import type { ExpenseReportJob } from "@/server/db/schema/app.schema";
import { ExpenseReportWithFiles } from "@/server/types/expense-report-jobs";
import { buildExpenseReportWorkbook } from "@/server/services/exports/expenseReportExcel";

export async function createExpenseReport({
  userId,
  title,
}: {
  userId: string;
  title?: string;
}): Promise<ExpenseReportJob> {
  const job = await createExpenseReportJob({
    userId: userId,
    title,
  });

  return job;
}

export async function getExpenseReports(
  userId: string
): Promise<ExpenseReportJob[]> {
  return getExpenseReportJobs(userId);
}

export async function getExpenseReport(
  jobId: string
): Promise<ExpenseReportJob> {
  return getExpenseReportJob(jobId);
}

export async function getExpenseReportWithFiles(
  jobId: string
): Promise<ExpenseReportWithFiles> {
  return getExpenseReportJobWithFiles(jobId);
}

export async function exportExpenseReport(jobId: string) {
  const job = await getExpenseReportJobWithReceiptAndExpense(jobId);
  return buildExpenseReportWorkbook(job);
}
