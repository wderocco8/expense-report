import { db } from "@/server/db/client";
import {
  ExpenseReportJob,
  expenseReportJobs,
  extractedExpenses,
  NewExpenseReportJob,
  receiptFiles,
  status,
} from "@/server/db/schema/app.schema";
import { and, eq, sql } from "drizzle-orm";

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
  data: NewExpenseReportJob,
): Promise<ExpenseReportJob> {
  const [job] = await db
    .insert(expenseReportJobs)
    .values({ ...data, title: generateJobTitle(data.title) })
    .returning();

  if (!job) {
    throw new Error("Failed to create expense report job");
  }

  return job;
}

export async function getExpenseReportJobs(
  userId: string,
): Promise<ExpenseReportJob[]> {
  return await db
    .select()
    .from(expenseReportJobs)
    .where(eq(expenseReportJobs.userId, userId));
}

export async function getExpenseReportJob(
  jobId: string,
): Promise<ExpenseReportJob> {
  const [job] = await db
    .select()
    .from(expenseReportJobs)
    .where(eq(expenseReportJobs.id, jobId));

  if (!job) {
    throw new Error("Failed to find expense report job");
  }

  return job;
}

export async function getExpenseReportJobWithFiles(
  jobId: string,
  userId: string,
) {
  const job = await db.query.expenseReportJobs.findFirst({
    where: and(
      eq(expenseReportJobs.id, jobId),
      eq(expenseReportJobs.userId, userId),
    ),
    with: {
      receiptFiles: true,
    },
  });

  if (!job) {
    throw new Error("Expense report job not found");
  }

  return job;
}

export async function getExpenseReportJobWithReceiptAndExpense(jobId: string) {
  const job = await db.query.expenseReportJobs.findFirst({
    where: eq(expenseReportJobs.id, jobId),
    with: {
      receiptFiles: {
        with: {
          extractedExpenses: {
            where: eq(extractedExpenses.isCurrent, true),
          },
        },
      },
    },
  });

  if (!job) {
    throw new Error("Expense report job not found");
  }

  return job;
}

export async function getExpenseReportJobsWithProgress(userId: string) {
  const jobs = await getExpenseReportJobs(userId);

  return await Promise.all(
    jobs.map(async (job) => {
      const progress = await getJobProgress(job.id);
      return {
        ...job,
        progress,
      };
    }),
  );
}

export async function getJobProgress(jobId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      processed: sql<number>`count(*) filter (where status in ('complete', 'failed'))::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    })
    .from(receiptFiles)
    .where(eq(receiptFiles.jobId, jobId));

  return row;
}
