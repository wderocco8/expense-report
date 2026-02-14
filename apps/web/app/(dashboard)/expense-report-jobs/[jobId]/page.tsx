import { ExpenseReportClient } from "@/components/expense-report-jobs/expense-report-client";
import { requirePageAuth } from "@/lib/auth/page";
import { getExpenseReportWithFiles } from "@/server/services/expenseReports.service";

export default async function ExpenseReportPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const session = await requirePageAuth();
  const { jobId } = await params;

  const job = await getExpenseReportWithFiles(jobId, session.user.id);

  return <ExpenseReportClient initialJob={job} />;
}
