import {
  createExpenseReportJob,
  getExpenseReportJobs,
  getExpenseReportJob,
  getExpenseReportJobWithFiles,
  getExpenseReportJobWithReceiptAndExpense,
} from "@/server/repositories/expenseReports.repo";
import type { ExpenseReportJob } from "@/server/db/schema";
import { ExpenseReportWithFiles } from "@/server/types/expense-report-jobs";
import { getObjectBuffer } from "@/server/services/storage.service";
import ExcelJS from "exceljs";

function toExcelImageBuffer(buf: Buffer): ExcelJS.Buffer {
  return buf as unknown as ExcelJS.Buffer;
}

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

export async function exportExpenseReport(jobId: string) {
  const job = await getExpenseReportJobWithReceiptAndExpense(jobId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Expenses");

  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Merchant", key: "merchant", width: 20 },
    { header: "Category", key: "category", width: 18 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Receipt", key: "receipt", width: 30 },
  ];

  for (const receipt of job.receiptFiles) {
    const buffer = await getObjectBuffer(receipt.s3Key);
    const imageId = workbook.addImage({
      buffer: toExcelImageBuffer(buffer),
      extension: "jpeg", // TODO: should this be determined from s3?
    });

    const row = sheet.addRow({
      date: receipt.extractedExpenses[0].date,
      merchant: receipt.extractedExpenses[0].merchant,
      category: receipt.extractedExpenses[0].category,
      amount: receipt.extractedExpenses[0].amount,
    });

    const rowNumber = row.number;

    sheet.addImage(imageId, {
      tl: { col: 5, row: rowNumber - 1 },
      ext: { width: 150, height: 200 },
    });

    sheet.getRow(rowNumber).height = 150;
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
