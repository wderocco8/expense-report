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
import { expenseReportJobProblems } from "@/lib/problems/domain/expenseReportJob";
import { getSchemaVersion } from "./schemaVersions.service";

export async function createExpenseReport({
  userId,
  schemaVersionId,
  title,
}: {
  userId: string;
  schemaVersionId: string;
  title?: string;
}): Promise<ExpenseReportJob> {
  // Throws if schemaVersionId doesn't resolve to a version whose parent
  // schema is owned by this user — without this, any authenticated user
  // could freeze a job to an arbitrary schema version id.
  await getSchemaVersion({ userId, versionId: schemaVersionId });

  const job = await repoCreateExpenseReportJob({
    userId,
    schemaVersionId,
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
  userId: string,
): Promise<ExpenseReportJob> {
  const job = repoGetExpenseReportJob(jobId, userId);

  if (!job) {
    throw expenseReportJobProblems.notFoundById(jobId);
  }

  return job;
}

export async function getExpenseReportWithFiles(
  jobId: string,
  userId: string,
): Promise<ExpenseReportWithFiles> {
  const job = await repoGetExpenseReportJobWithFiles(jobId, userId);

  if (!job) {
    throw expenseReportJobProblems.notFoundById(jobId);
  }

  return job;
}

export async function exportExpenseReport(jobId: string) {
  const job = await repoGetExpenseReportJobWithReceiptAndExpense(jobId);

  if (!job) {
    throw expenseReportJobProblems.notFoundById(jobId);
  }

  return buildExpenseReportWorkbook(job);
}

export async function getExpenseReportJobsWithProgress(
  userId: string,
): Promise<ExpenseReportJobsWithProgress> {
  return repoGetExpenseReportJobsWithProgress(userId);
}
