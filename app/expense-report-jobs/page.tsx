import CreateExpenseReportJob from "@/components/expense-report-jobs/create-expense-report-job";
import { JobsTable } from "@/components/expense-report-jobs/jobs-table";
import { getExpenseReports } from "@/server/services/expenseReports.service";

export default async function ExpenseReportsPage() {
  const jobs = await getExpenseReports();

  return (
    <div className="container mx-auto py-8 space-y-8">
      <CreateExpenseReportJob />
      <JobsTable data={jobs} />
    </div>
  );
}
