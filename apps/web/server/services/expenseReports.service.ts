import {
  createExpenseReportJob as repoCreateExpenseReportJob,
  getExpenseReportJobs as repoGetExpenseReportJobs,
  getExpenseReportJob as repoGetExpenseReportJob,
  getExpenseReportJobWithFiles as repoGetExpenseReportJobWithFiles,
  getExpenseReportJobWithReceiptAndExpense as repoGetExpenseReportJobWithReceiptAndExpense,
  getExpenseReportJobsWithProgress as repoGetExpenseReportJobsWithProgress,
  type ExpenseReportJob,
  createExtractedExpense,
} from "@repo/db";

import {
  ExpenseReportJobsWithProgress,
  ExpenseReportWithFiles,
} from "@/server/types/expense-report-jobs";
import { buildExpenseReportWorkbook } from "@/server/services/exports/expenseReportExcel";
import { expenseReportJobProblems } from "@/lib/problems/domain/expenseReportJob";
import { createReceiptFile, persistReceiptFile } from "./receipts.service";
import { ReceiptDTO, mapReceiptToDb } from "@repo/shared";

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

export async function manualUpload({
  jobId,
  file,
  expensePayload,
}: {
  jobId: string;
  file: File;
  expensePayload: ReceiptDTO;
}) {
  const key = await persistReceiptFile({ jobId, file });
  const receipt = await createReceiptFile({
    jobId,
    originalFilename: file.name,
    s3Key: key,
    status: "complete",
  });

  const dbExpense = mapReceiptToDb(expensePayload, receipt.id);

  await createExtractedExpense(dbExpense);
}
