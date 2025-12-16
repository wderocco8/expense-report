"use client";

import { useState } from "react";
import { ReceiptFilesTable } from "@/components/receipt-files/receipt-files-table";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import { ExtractedExpenseSheet } from "@/components/receipt-files/extracted-expenses/extracted-expense-sheet";

export function ReceiptFilesSection({
  receiptFiles,
}: {
  receiptFiles: ReceiptFileWithExpenses[];
}) {
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);

  return (
    <>
      <ReceiptFilesTable data={receiptFiles} onViewReceipt={setOpenReceiptId} />

      <ExtractedExpenseSheet
        receiptId={openReceiptId}
        open={!!openReceiptId}
        onClose={() => setOpenReceiptId(null)}
      />
    </>
  );
}
