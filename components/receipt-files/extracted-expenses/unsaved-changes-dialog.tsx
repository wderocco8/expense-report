import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UnsavedChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSubmit,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Navigating away will discard them. Are you
            sure?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          <Button variant="destructive" onClick={onSubmit}>
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
