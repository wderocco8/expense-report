"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/expense-report-jobs/columns";
import { ExpenseReportJobsWithProgress } from "@/server/types/expense-report-jobs";

interface JobsTableProps {
  data: ExpenseReportJobsWithProgress;
  isLoading: boolean;
}

export function JobsTable({ data, isLoading }: JobsTableProps) {
  return <DataTable columns={columns} data={data} isLoading={isLoading} />;
}
