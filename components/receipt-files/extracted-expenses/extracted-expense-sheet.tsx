import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
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

        <div className="flex-1 px-4">
          {!expense ? (
            <div className="text-sm text-muted-foreground">
              No extracted expense found for this receipt.
            </div>
          ) : (
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Expense Details</FieldLegend>
                <FieldDescription>
                  General details regarding your expense
                </FieldDescription>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="category">Category</FieldLabel>
                    <Input id="category" readOnly value={expense.category} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
                    <Input
                      id="merchant"
                      readOnly
                      value={expense.merchant ?? "—"}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Input
                      id="description"
                      readOnly
                      value={expense.description ?? "—"}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="amount">Amount</FieldLabel>
                    <Input id="amount" readOnly value={expense.amount ?? "—"} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="date">Date</FieldLabel>
                    <Input id="date" readOnly value={expense.date ?? "—"} />
                  </Field>
                </FieldGroup>
              </FieldSet>

              {expense.transportDetails && (
                <>
                  <FieldSeparator />
                  <FieldSet>
                    <FieldLegend variant="label">Transport Details</FieldLegend>
                    <FieldDescription>
                      Transport-specific details regarding your receipt
                    </FieldDescription>

                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="mode">Mode</FieldLabel>
                        <Input
                          id="mode"
                          readOnly
                          value={expense.transportDetails.mode ?? ""}
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="mileage">Mileage</FieldLabel>
                        <Input
                          id="mileage"
                          readOnly
                          value={
                            expense.transportDetails.mileage?.toString() ?? "—"
                          }
                        />
                      </Field>
                    </FieldGroup>
                  </FieldSet>
                </>
              )}
            </FieldGroup>
          )}

          {expense && (
            <div className="pt-4 text-xs text-muted-foreground">
              Model version: {expense.modelVersion}
            </div>
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
