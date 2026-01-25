import {
  createExpenseReportJob as repoCreateExpenseReportJob,
  getExpenseReportJobs as repoGetExpenseReportJobs,
  getExpenseReportJob as repoGetExpenseReportJob,
  getExpenseReportJobWithFiles as repoGetExpenseReportJobWithFiles,
  getExpenseReportJobWithReceiptAndExpense as repoGetExpenseReportJobWithReceiptAndExpense,
  getExpenseReportJobsWithProgress as repoGetExpenseReportJobsWithProgress,
  type ExpenseReportJob,
} from "@repo/db";

import {
  ExpenseReportJobsWithProgress,
  ExpenseReportWithFiles,
} from "@/server/types/expense-report-jobs";
import { buildExpenseReportWorkbook } from "@/server/services/exports/expenseReportExcel";

export async function createExpenseReport({
  userId,
  title,
}: {
  userId: string;
  title?: string;
}): Promise<ExpenseReportJob> {
  const job = await repoCreateExpenseReportJob({
    userId: userId,
    title,
  });

  return job;
}

export async function getExpenseReports(
  userId: string,
): Promise<ExpenseReportJob[]> {
  return repoGetExpenseReportJobs(userId);
}

export async function getExpenseReport(
  jobId: string,
): Promise<ExpenseReportJob> {
  return repoGetExpenseReportJob(jobId);
}

export async function getExpenseReportWithFiles(
  jobId: string,
  userId: string,
): Promise<ExpenseReportWithFiles> {
  return repoGetExpenseReportJobWithFiles(jobId, userId);
}

export async function exportExpenseReport(jobId: string) {
  const job = await repoGetExpenseReportJobWithReceiptAndExpense(jobId);
  return buildExpenseReportWorkbook(job);
}

export async function getExpenseReportJobsWithProgress(
  userId: string,
): Promise<ExpenseReportJobsWithProgress> {
  return repoGetExpenseReportJobsWithProgress(userId);
}
