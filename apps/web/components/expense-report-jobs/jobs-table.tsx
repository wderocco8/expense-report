"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/expense-report-jobs/columns";
import { ExpenseReportJobsWithProgress } from "@/server/types/expense-report-jobs";

interface JobsTableProps {
  data: ExpenseReportJobsWithProgress;
  isLoading: boolean;
}

export function JobsTable({ data, isLoading }: JobsTableProps) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      onRowClick={(row) => router.push(`/expense-report-jobs/${row.id}`)}
    />
  );
}
