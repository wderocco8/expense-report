"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/expense-report-jobs/columns";
import { ExpenseReportJobsWithProgress } from "@/server/types/expense-report-jobs";

export function JobsTable({ data }: { data: ExpenseReportJobsWithProgress }) {
  return <DataTable columns={columns} data={data} />;
}
