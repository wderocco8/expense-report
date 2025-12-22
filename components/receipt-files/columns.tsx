"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";

export const columns = (
  onViewReceipt: (id: string) => void
): ColumnDef<ReceiptFileWithExpenses>[] => [
  {
    accessorKey: "originalFilename",
    header: "Receipt",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    accessorKey: "createdAt",
    header: "Uploaded",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewReceipt(row.original.id)}
      >
        View
      </Button>
    ),
  },
];
