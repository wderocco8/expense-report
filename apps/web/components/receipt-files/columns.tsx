"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import { SortableHeader } from "@/components/ui/sortable-header";

const statusVariantMap = {
  pending: "pending",
  ocr_processing: "processing",
  ocr_complete: "processing",
  extracting: "processing",
  complete: "complete",
  failed: "failed",
} as const;

export const columns: ColumnDef<ReceiptFileWithExpenses>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "originalFilename",
    header: ({ column }) => {
      return <SortableHeader column={column} label="Filename" />;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return <SortableHeader column={column} label="Status" />;
    },
    cell: ({ row }) => (
      <Badge variant={statusVariantMap[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return <SortableHeader column={column} label="Uploaded" />;
    },
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
];
