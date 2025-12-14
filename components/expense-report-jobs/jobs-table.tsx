"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/expense-report-jobs/columns";
import { ExpenseReportJob } from "@/server/db/schema";

export function JobsTable({ data }: { data: ExpenseReportJob[] }) {
  return <DataTable columns={columns} data={data} />;
}
