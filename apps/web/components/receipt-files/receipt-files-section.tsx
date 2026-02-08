"use client";

import { useMemo, useState } from "react";
import { ReceiptFilesTable } from "@/components/receipt-files/receipt-files-table";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";
import { ExtractedExpenseSheet } from "@/components/receipt-files/extracted-expenses/extracted-expense-sheet";
import ExportReceipts from "@/components/receipt-files/export-receipts";
import { toast } from "sonner";
import {
  DialogHeader,
  DialogFooter,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadReceiptsSheet } from "./upload-receipts-sheet";

export function ReceiptFilesSection({
  jobId,
  receiptFiles,
}: {
  jobId: string;
  receiptFiles: ReceiptFileWithExpenses[];
}) {
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);

  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const receiptMap = useMemo(
    () => new Map(receiptFiles.map((r) => [r.id, r])),
    [receiptFiles],
  );

  const receipt = openReceiptId ? receiptMap.get(openReceiptId) : null;

  const currentIndex = receiptFiles.findIndex((r) => r.id === openReceiptId);

  const goPrev = () => {
    if (currentIndex > 0) setOpenReceiptId(receiptFiles[currentIndex - 1].id);
  };
  const goNext = () => {
    if (currentIndex < receiptFiles.length - 1)
      setOpenReceiptId(receiptFiles[currentIndex + 1].id);
  };

  async function confirmDeleteReceipt() {
    if (!deleteTargetId) return;

    try {
      const res = await fetch(`/api/receipts/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete receipt");
      setDeleteTargetId(null);
      toast.success("Successfully deleted receipt");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete receipt");
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button type="button" onClick={() => setUploadSheetOpen(true)}>
          Create Expense
        </Button>
        <ExportReceipts jobId={jobId} />
      </div>
      <ReceiptFilesTable
        data={receiptFiles}
        onViewReceipt={setOpenReceiptId}
        onDeleteReceipt={(id) => setDeleteTargetId(id)}
        openReceiptId={openReceiptId}
      />

      <Dialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Do you really want to delete this
              receipt?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteReceipt}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadReceiptsSheet
        open={uploadSheetOpen}
        onOpenChange={setUploadSheetOpen}
        jobId={jobId}
      />

      <ExtractedExpenseSheet
        receipt={receipt}
        open={!!openReceiptId}
        onClose={() => setOpenReceiptId(null)}
        onPrev={goPrev}
        onNext={goNext}
        hasPrev={currentIndex > 0}
        hasNext={currentIndex < receiptFiles.length - 1}
      />
    </>
  );
}
