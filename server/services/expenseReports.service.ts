import * as expenseReportJobsRepo from "@/server/repositories/expenseReports.repo";
import type { ExpenseReportJob } from "@/server/db/schema/app.schema";
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
  const job = await expenseReportJobsRepo.createExpenseReportJob({
    userId: userId,
    title,
  });

  return job;
}

export async function getExpenseReports(
  userId: string
): Promise<ExpenseReportJob[]> {
  return expenseReportJobsRepo.getExpenseReportJobs(userId);
}

export async function getExpenseReport(
  jobId: string
): Promise<ExpenseReportJob> {
  return expenseReportJobsRepo.getExpenseReportJob(jobId);
}

export async function getExpenseReportWithFiles(
  jobId: string,
  userId: string
): Promise<ExpenseReportWithFiles> {
  return expenseReportJobsRepo.getExpenseReportJobWithFiles(jobId, userId);
}

export async function exportExpenseReport(jobId: string) {
  const job =
    await expenseReportJobsRepo.getExpenseReportJobWithReceiptAndExpense(jobId);
  return buildExpenseReportWorkbook(job);
}

export async function getExpenseReportJobsWithProgress(
  userId: string
): Promise<ExpenseReportJobsWithProgress> {
  return expenseReportJobsRepo.getExpenseReportJobsWithProgress(userId);
}
