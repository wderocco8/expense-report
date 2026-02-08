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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, ScanText } from "lucide-react";
import { ScanUploadReceipts } from "@/components/receipt-files/scan-upload-receipts";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

type UploadReceiptsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
};

export function UploadReceiptsSheet({
  open,
  onOpenChange,
  jobId,
}: UploadReceiptsSheetProps) {
  const [tab, setTab] = useState<"scan" | "manual">("scan");
  const [scanSubmitting, setScanSubmitting] = useState(false);

  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right-resize" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Upload Expense</SheetTitle>
          <SheetDescription>
            Drag and drop your receipts, or manually upload.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 flex-1 min-h-0 overflow-hidden">
          <Tabs
            defaultValue="scan"
            className="flex h-full w-full flex-col gap-6 min-h-0"
            value={tab}
            onValueChange={(v) => setTab(v as "scan" | "manual")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="manual">
                <Pencil />
                Manual
              </TabsTrigger>
              <TabsTrigger value="scan">
                <ScanText />
                Scan
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="flex-1">
              Make changes to your manual here.
            </TabsContent>
            <TabsContent value="scan" className="flex-1 min-h-0">
              <ScanUploadReceipts
                jobId={jobId}
                onSuccess={handleSuccess}
                onSubmittingChange={setScanSubmitting}
              />
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter>
          {tab === "scan" && (
            <Button
              type="submit"
              form="scan-upload-form"
              disabled={scanSubmitting}
            >
              {scanSubmitting && <Spinner data-icon="inline-start" />}
              Upload
            </Button>
          )}
          {tab === "manual" && (
            <Button type="submit" form="manual-form">
              Save
            </Button>
          )}
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
