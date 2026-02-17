"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";

import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  isFetching?: boolean;
  rowClassName?: (row: TData) => string;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  manualPagination?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  totalRows?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  isFetching,
  rowClassName,
  pageCount,
  pagination,
  onPaginationChange,
  manualPagination,
  sorting,
  onSortingChange,
  totalRows,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: manualPagination
      ? undefined
      : getPaginationRowModel(),
    onSortingChange: onSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: onPaginationChange,
    state: {
      sorting: sorting ?? [],
      columnFilters,
      rowSelection,
      ...(manualPagination && pagination ? { pagination } : {}),
    },
    manualPagination: manualPagination ?? false,
    pageCount: pageCount,
    manualSorting: true,
    manualFiltering: true,
  });

  const skeletonRowCount = pagination?.pageSize ?? 5;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton rows
              Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={`skeleton-cell-${colIndex}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              // Normal rows
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={rowClassName ? rowClassName(row.original) : ""}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {manualPagination && <DataTablePagination table={table} />}
    </div>
  );
}
