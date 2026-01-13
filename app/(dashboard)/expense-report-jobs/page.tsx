export const dynamic = "force-dynamic";

import CreateExpenseReportJob from "@/components/expense-report-jobs/create-expense-report-job";
import { JobsTable } from "@/components/expense-report-jobs/jobs-table";
import { requirePageAuth } from "@/lib/auth/page";
import { getExpenseReports } from "@/server/services/expenseReports.service";

export default async function ExpenseReportsPage() {
  const session = await requirePageAuth();
  const jobs = await getExpenseReports(session.user.id);

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <CreateExpenseReportJob />
        <JobsTable data={jobs} />
      </div>
    </div>
  );
}
