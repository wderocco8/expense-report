"use client";

import CreateExpenseReportJob from "@/components/expense-report-jobs/create-expense-report-job";
import { JobsTable } from "@/components/expense-report-jobs/jobs-table";
import { ExpenseReportJobsWithProgress } from "@/server/types/expense-report-jobs";
import { useQuery } from "@tanstack/react-query";

async function fetchJobs(): Promise<ExpenseReportJobsWithProgress> {
  const res = await fetch("/api/expense-reports");
  if (!res.ok) throw new Error("Failed to fetch jobs");
  return res.json();
}

export default function ExpenseReportsPage() {
  const { data, isLoading } = useQuery<ExpenseReportJobsWithProgress>({
    queryKey: ["expense-reports"],
    queryFn: fetchJobs,
  });

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl space-y-8">
        <CreateExpenseReportJob />
        <JobsTable data={data ?? []} isLoading={isLoading} />
      </div>
    </div>
  );
}
