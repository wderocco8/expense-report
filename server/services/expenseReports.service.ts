import {
  createExpenseReportJob,
  getExpenseReportJobs,
  getExpenseReportJob,
  getExpenseReportJobWithFiles,
} from "@/server/repositories/expenseReports.repo";
import type { ExpenseReportJob } from "@/server/db/schema";
import { ExpenseReportWithFiles } from "@/server/types/expense-report-jobs";

export async function createExpenseReport(input?: {
  title?: string;
}): Promise<ExpenseReportJob> {
  // future hooks live here:
  // - auth (userId)
  // - quotas
  // - defaults
  // - analytics

  const job = await createExpenseReportJob(input?.title);

  return job;
}

export async function getExpenseReports(): Promise<ExpenseReportJob[]> {
  return getExpenseReportJobs();
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
