import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScanUploadReceipts } from "@/components/receipt-files/scan-upload-receipts";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

type UploadReceiptsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  jobId: string;
};

export function UploadReceiptsSheet({
  open,
  onOpenChange,
  onSuccess,
  jobId,
}: UploadReceiptsSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSuccess = () => {
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && isSubmitting) return;
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="flex flex-col"
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle>Upload Expense</SheetTitle>
          <SheetDescription>
            Drag and drop your receipts, or manually upload.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 flex-1 min-h-0 overflow-hidden">
          <ScanUploadReceipts
            jobId={jobId}
            onSuccess={handleSuccess}
            onSubmittingChange={setIsSubmitting}
          />
        </div>

        <SheetFooter>
          <Button type="submit" form="scan-upload-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Upload
          </Button>
          <SheetClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
