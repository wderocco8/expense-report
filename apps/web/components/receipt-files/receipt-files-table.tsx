"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/receipt-files/columns";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import { ReceiptFile } from "@repo/db";
import {
  OnChangeFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";

interface ReceiptFilesTableProps {
  data: ReceiptFileWithExpenses[] | ReceiptFile[];
  onViewReceipt: (id: string) => void;
  onDeleteReceipt: (id: string) => void;
  openReceiptId?: string | null;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  totalRows?: number;
}

export function ReceiptFilesTable({
  data,
  onViewReceipt,
  onDeleteReceipt,
  openReceiptId,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  totalRows,
}: ReceiptFilesTableProps) {
  return (
    <DataTable
      columns={columns({ onView: onViewReceipt, onDelete: onDeleteReceipt })}
      data={data}
      rowClassName={(row) => (row.id === openReceiptId ? "bg-muted" : "")}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      manualPagination={!!onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      totalRows={totalRows}
    />
  );
}
