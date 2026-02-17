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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerTableState } from "@/hooks/data-table/user-server-table-state";
import { PaginationState, SortingState } from "@tanstack/react-table";
import { Spinner } from "@/components/ui/spinner";

interface PaginatedReceiptFiles {
  data: ReceiptFileWithExpenses[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchReceiptFiles(
  jobId: string,
  pagination: PaginationState,
  sorting: SortingState,
): Promise<PaginatedReceiptFiles> {
  const sort = sorting.map((s) => ({
    field: s.id,
    direction: s.desc ? "desc" : "asc",
  }));

  const params = new URLSearchParams({
    page: String(pagination.pageIndex + 1),
    limit: String(pagination.pageSize),
    ...(sort.length ? { sort: JSON.stringify(sort) } : {}),
  });

  const res = await fetch(`/api/receipts/by-job/${jobId}?${params}`);

  if (!res.ok) {
    throw new Error("Failed to fetch receipt files");
  }
  return res.json();
}

export function ReceiptFilesSection({ jobId }: { jobId: string }) {
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const {
    pagination,
    setPagination,
    sorting,
    setSorting,
    filters,
    setFilters,
  } = useServerTableState();

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [
      "receipt-files",
      jobId,
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
    ],
    queryFn: () => fetchReceiptFiles(jobId, pagination, sorting),
    initialData: {
      data: [],
      total: 0,
      page: 1,
      limit: pagination.pageSize,
      totalPages: 0,
    },
  });

  const receiptFiles = data.data;

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
    setIsSubmittingDelete(true);

    try {
      const res = await fetch(`/api/receipts/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete receipt");
      setDeleteTargetId(null);
      toast.success("Successfully deleted receipt");
      queryClient.invalidateQueries({ queryKey: ["receipt-files", jobId] });
      queryClient.invalidateQueries({ queryKey: ["expense-report", jobId] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete receipt");
    } finally {
      setIsSubmittingDelete(false);
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
        pageCount={data.totalPages}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        totalRows={data.total}
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
            <Button
              variant="destructive"
              onClick={confirmDeleteReceipt}
              disabled={isSubmittingDelete}
            >
              {isSubmittingDelete && <Spinner />}
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
