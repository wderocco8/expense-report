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
import { useRouter } from "next/navigation";

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
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  // const [manualData, setManualData] = useState<ManualData | null>(null);
  const [tab, setTab] = useState<"scan" | "manual">("scan");

  const router = useRouter();

  const handleUpload = async () => {
    const formData = new FormData();

    formData.append("jobId", jobId);

    if (tab === "scan") {
      scanFiles.forEach((f) => formData.append("files", f));
    }

    // if (tab === "manual") {
    //   formData.append("manual", JSON.stringify(manualData));
    // }

    const res = await fetch("/api/receipts", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return;

    router.refresh();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right-resize">
        <SheetHeader>
          <SheetTitle>Upload Expense</SheetTitle>
          <SheetDescription>
            Drag and drop your receipts, or manually upload.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 h-full">
          <Tabs
            defaultValue="scan"
            className="flex h-full w-full flex-col gap-6"
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
            <TabsContent value="scan" className="flex-1">
              <ScanUploadReceipts
                files={scanFiles}
                onFilesChange={setScanFiles}
              />
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter>
          <Button onClick={handleUpload}>Upload</Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
