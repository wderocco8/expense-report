"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/receipt-files/columns";
import { ReceiptFile } from "@/server/db/schema";

export function ReceiptFilesTable({ data }: { data: ReceiptFile[] }) {
  return <DataTable columns={columns} data={data} />;
}
