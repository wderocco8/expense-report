"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExpenseReportJobsWithProgress } from "@/server/types/expense-report-jobs";
import { deriveJobStatus } from "@repo/shared";

const statusVariantMap = {
  pending: "pending",
  processing: "processing",
  complete: "complete",
  failed: "failed",
} as const;

export const columns: ColumnDef<ExpenseReportJobsWithProgress[number]>[] = [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = deriveJobStatus(row.original.progress);
      return <Badge variant={statusVariantMap[status]}>{status}</Badge>;
    },
  },
  {
    accessorKey: "processedFiles",
    header: "Processed Receipts",
    cell: ({ row }) => row.original.progress.processed,
  },
  {
    accessorKey: "totalFiles",
    header: "Total Receipts",
    cell: ({ row }) => row.original.progress.total,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm">
        <Link href={`/expense-report-jobs/${row.original.id}`}>View</Link>
      </Button>
    ),
  },
];
