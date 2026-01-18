"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/receipt-files/columns";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";

export function ReceiptFilesTable({
  data,
  onViewReceipt,
  onDeleteReceipt,
  openReceiptId,
}: {
  data: ReceiptFileWithExpenses[];
  onViewReceipt: (id: string) => void;
  onDeleteReceipt: (id: string) => void;
  openReceiptId?: string | null;
}) {
  return (
    <DataTable
      columns={columns({ onView: onViewReceipt, onDelete: onDeleteReceipt })}
      data={data}
      rowClassName={(row) => (row.id === openReceiptId ? "bg-muted" : "")}
    />
  );
}
