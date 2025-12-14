import { db } from "@/server/db/client";
import { expenseReportJobs } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function createExpenseReportJob(totalFiles: number) {
  const [job] = await db
    .insert(expenseReportJobs)
    .values({
      totalFiles,
      status: "pending",
    })
    .returning();

  return job;
}

export async function updateJobStatus(
  jobId: string,
  status: "pending" | "processing" | "complete" | "failed"
) {
  await db
    .update(expenseReportJobs)
    .set({ status, updatedAt: new Date() })
    .where(eq(expenseReportJobs.id, jobId));
}
