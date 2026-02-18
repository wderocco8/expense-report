import { Column } from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type SortableHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  label: string;
};

export function SortableHeader<TData, TValue>({
  column,
  label,
}: SortableHeaderProps<TData, TValue>) {
  const sorted = column.getIsSorted();

  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Button variant="ghost" onClick={() => column.toggleSorting()}>
      {label}
      <Icon className="ml-2 h-4 w-4" />
    </Button>
  );
}
