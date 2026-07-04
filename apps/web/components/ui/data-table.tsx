"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  PaginationState,
  OnChangeFn,
  RowSelectionState,
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
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  manualPagination?: boolean;
  manualFiltering?: boolean;
  manualSorting?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  totalRows?: number;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  rowClassName,
  onRowClick,
  getRowId,
  pageCount,
  pagination,
  onPaginationChange,
  manualPagination,
  manualFiltering,
  manualSorting,
  sorting,
  onSortingChange,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});

  const isControlled = controlledRowSelection !== undefined;
  const rowSelection = isControlled
    ? controlledRowSelection
    : internalRowSelection;

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: onSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: isControlled
      ? onRowSelectionChange
      : setInternalRowSelection,
    onPaginationChange: onPaginationChange,
    getRowId: getRowId,
    state: {
      sorting: sorting ?? [],
      columnFilters,
      rowSelection,
      ...(manualPagination && pagination ? { pagination } : {}),
    },
    manualPagination: manualPagination ?? false,
    pageCount: pageCount,
    manualSorting: manualSorting,
    manualFiltering: manualFiltering,
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`${rowClassName ? rowClassName(row.original) : ""}${onRowClick ? " cursor-pointer" : ""}`}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
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
