import { db } from "@/server/db/client";
import {
  ExpenseReportJob,
  expenseReportJobs,
  extractedExpenses,
  NewExpenseReportJob,
  status,
} from "@/server/db/schema/app.schema";
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
  data: NewExpenseReportJob
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

export async function getExpenseReportJobs(): Promise<ExpenseReportJob[]> {
  return await db.select().from(expenseReportJobs);
}

export async function getExpenseReportJob(
  jobId: string
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

export async function getExpenseReportJobWithFiles(jobId: string) {
  const job = await db.query.expenseReportJobs.findFirst({
    where: eq(expenseReportJobs.id, jobId),
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
