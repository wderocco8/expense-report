"use client";

import { useMemo, useState } from "react";
import { ReceiptFilesTable } from "@/components/receipt-files/receipt-files-table";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import { ExtractedExpenseSheet } from "@/components/receipt-files/extracted-expenses/extracted-expense-sheet";
import UploadReceipts from "@/components/receipt-files/upload-receipts";
import ExportReceipts from "@/components/receipt-files/export-receipts";
import { toast } from "sonner";

export function ReceiptFilesSection({
  jobId,
  receiptFiles,
}: {
  jobId: string;
  receiptFiles: ReceiptFileWithExpenses[];
}) {
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);

  const receiptMap = useMemo(
    () => new Map(receiptFiles.map((r) => [r.id, r])),
    [receiptFiles],
  );

  const receipt = openReceiptId ? receiptMap.get(openReceiptId) : null;

  async function deleteReceipt(id: string) {
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete receipt");
      // reload the page to reflect changes
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete receipt");
    }
  }

  return (
    <>
      <ExportReceipts jobId={jobId} />
      <UploadReceipts jobId={jobId} />
      <ReceiptFilesTable
        data={receiptFiles}
        onViewReceipt={setOpenReceiptId}
        onDeleteReceipt={deleteReceipt}
      />
      <ExtractedExpenseSheet
        receipt={receipt}
        open={!!openReceiptId}
        onClose={() => setOpenReceiptId(null)}
      />
    </>
  );
}
