"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { SortableHeader } from "@/components/ui/sortable-header";

const statusVariantMap = {
  pending: "pending",
  processing: "processing",
  complete: "complete",
  failed: "failed",
} as const;

type ColumnsInput = {
  onView: (id: string) => void;
  onDelete: (id: string) => void;
};

export const columns = ({
  onView,
  onDelete,
}: ColumnsInput): ColumnDef<ReceiptFileWithExpenses>[] => [
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
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(row.original.id)}>
              View
            </DropdownMenuItem>

            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(row.original.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
