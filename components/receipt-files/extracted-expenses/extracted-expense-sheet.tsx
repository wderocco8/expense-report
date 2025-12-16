import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReceiptFileWithExpenses } from "@/server/types/expense-report-jobs";

export function ExtractedExpenseSheet({
  receipt,
  open,
  onClose,
}: {
  receipt: ReceiptFileWithExpenses | null | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const expenses = receipt?.extractedExpenses ?? [];

  if (expenses.length > 1) {
    throw new Error(
      `Invariant violated: expected 0 or 1 extracted expense, got ${expenses.length}`
    );
  }

  const expense = expenses[0];

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Extracted Expense</SheetTitle>
          <SheetDescription>
            AI-extracted expense details from this receipt.
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 auto-rows-min gap-6 px-4">
          {!expense ? (
            <div className="text-sm text-muted-foreground">
              No extracted expense found for this receipt.
            </div>
          ) : (
            <>
              <DisplayField label="Category" value={expense.category} />
              <DisplayField label="Merchant" value={expense.merchant} />
              <DisplayField label="Description" value={expense.description} />
              <DisplayField label="Amount" value={expense.amount} />
              <DisplayField label="Date" value={expense.date} />

              {expense.transportDetails && (
                <>
                  <div className="pt-2 text-sm font-medium">
                    Transport Details
                  </div>
                  <DisplayField
                    label="Mode"
                    value={expense.transportDetails.mode}
                  />
                  <DisplayField
                    label="Mileage"
                    value={expense.transportDetails.mileage?.toString() ?? null}
                  />
                </>
              )}

              <div className="pt-2 text-xs text-muted-foreground">
                Model version: {expense.modelVersion}
              </div>
            </>
          )}
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

function DisplayField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input readOnly value={value ?? "—"} />
    </div>
  );
}
