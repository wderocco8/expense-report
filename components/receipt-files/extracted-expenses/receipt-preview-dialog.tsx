import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";

export default function ReceiptPreviewDialog({
  open,
  onOpenChange,
  imageUrl,
  imageAlt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  imageAlt: string | null;
}) {
  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Receipt {imageAlt && " " + imageAlt}</DialogTitle>
        </DialogHeader>

        <div className="relative w-full max-w-2xl h-[80vh]">
          <Image
            src={imageUrl}
            alt={imageAlt ?? "Receipt"}
            fill
            unoptimized
            className="rounded-md object-contain"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
