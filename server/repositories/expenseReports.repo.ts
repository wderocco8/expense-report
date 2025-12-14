import { db } from "@/server/db/client";
import {
  ExpenseReportJob,
  expenseReportJobs,
  status,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";

function generateJobTitle(title?: string): string {
  if (title) return title;
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `Expense report - ${formattedDate}`;
}

export async function createExpenseReportJob(
  title?: string
): Promise<ExpenseReportJob> {
  const [job] = await db
    .insert(expenseReportJobs)
    .values({ title: generateJobTitle(title) })
    .returning();

  if (!job) {
    throw new Error("Failed to create expense report job");
  }

  return job;
}

export async function getExpenseReportJobs(): Promise<ExpenseReportJob[]> {
  return await db.select().from(expenseReportJobs);
}

export async function updateJobStatus(
  jobId: string,
  jobStatus: (typeof status.enumValues)[number]
): Promise<ExpenseReportJob> {
  const [job] = await db
    .update(expenseReportJobs)
    .set({ status: jobStatus, updatedAt: new Date() })
    .where(eq(expenseReportJobs.id, jobId))
    .returning();

  if (!job) {
    throw new Error("Job not found");
  }

  return job;
}
