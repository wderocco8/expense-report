"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/receipt-files/columns";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";

interface ReceiptFilesTableProps {
  data: ReceiptFileWithExpenses[];
  onRowClick: (receipt: ReceiptFileWithExpenses) => void;
  isLoading: boolean;
  isFetching: boolean;
  openReceiptId?: string | null;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  totalRows?: number;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
}

export function ReceiptFilesTable({
  data,
  onRowClick,
  isLoading,
  isFetching,
  openReceiptId,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  totalRows,
  rowSelection,
  onRowSelectionChange,
}: ReceiptFilesTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      rowClassName={(row) => (row.id === openReceiptId ? "bg-muted" : "")}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      manualPagination={!!onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      totalRows={totalRows}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
    />
  );
}
