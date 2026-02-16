import {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

export function useServerTableState() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);

  return {
    pagination,
    setPagination,
    sorting,
    setSorting,
    filters,
    setFilters,
  };
}
