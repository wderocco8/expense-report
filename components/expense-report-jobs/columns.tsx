"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ExpenseReportJob } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const columns: ColumnDef<ExpenseReportJob>[] = [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    accessorKey: "processedFiles",
    header: "Processed Receipts",
  },
  {
    accessorKey: "totalFiles",
    header: "Total Receipts",
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
        View
      </Button>
    ),
  },
];
