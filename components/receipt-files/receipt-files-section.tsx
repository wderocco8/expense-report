"use client";

import { useMemo, useState } from "react";
import { ReceiptFilesTable } from "@/components/receipt-files/receipt-files-table";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import { ExtractedExpenseSheet } from "@/components/receipt-files/extracted-expenses/extracted-expense-sheet";
import UploadReceipts from "@/components/receipt-files/upload-receipts";

export function ReceiptFilesSection({
  jobId,
  receiptFiles,
}: {
  jobId: string;
  receiptFiles: ReceiptFileWithExpenses[];
}) {
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);

  // TODO: maybe remove this eventually and have ExtractedExpenseSheet fetch the extracted-expenses
  const receiptMap = useMemo(
    () => new Map(receiptFiles.map((r) => [r.id, r])),
    [receiptFiles]
  );

  const receipt = openReceiptId ? receiptMap.get(openReceiptId) : null;

  return (
    <>
      <UploadReceipts jobId={jobId} />
      <ReceiptFilesTable data={receiptFiles} onViewReceipt={setOpenReceiptId} />
      <ExtractedExpenseSheet
        receiptId={receipt?.id}
        open={!!openReceiptId}
        onClose={() => setOpenReceiptId(null)}
      />
    </>
  );
}
