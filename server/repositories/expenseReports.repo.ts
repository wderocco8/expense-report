import { db } from "@/server/db/client";
import { expenseReportJobs, status } from "@/server/db/schema";
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

export async function createExpenseReportJob(title?: string) {
  const [job] = await db
    .insert(expenseReportJobs)
    .values({ title: generateJobTitle(title) })
    .returning();

  return job;
}

export async function updateJobStatus(
  jobId: string,
  jobStatus: (typeof status.enumValues)[number]
) {
  await db
    .update(expenseReportJobs)
    .set({ status: jobStatus, updatedAt: new Date() })
    .where(eq(expenseReportJobs.id, jobId));
}
