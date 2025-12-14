import { createExpenseReportJob } from "@/server/repositories/expenseReports.repo";
import type { ExpenseReportJob } from "@/server/db/schema";

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
