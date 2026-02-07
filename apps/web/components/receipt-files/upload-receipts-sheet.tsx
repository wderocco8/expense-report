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

type UploadReceiptsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UploadReceiptsSheet({
  open,
  onOpenChange,
}: UploadReceiptsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right-resize">
        <SheetHeader>
          <SheetTitle>Upload Expense</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <Tabs defaultValue="scan" className="w-full">
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
            <TabsContent value="manual">
              Make changes to your manual here.
            </TabsContent>
            <TabsContent value="scan">Change your scan here.</TabsContent>
          </Tabs>
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
