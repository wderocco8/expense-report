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
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExtractedExpenseUpdateSchema } from "@/server/validators/extractedExpense.zod";
import { useEffect } from "react";

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

  const router = useRouter();

  type FormValues = z.infer<typeof ExtractedExpenseUpdateSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(ExtractedExpenseUpdateSchema),
    defaultValues: expense
      ? {
          category: expense.category,
          merchant: expense.merchant ?? "",
          description: expense.description ?? "",
          amount: expense.amount,
          date: expense.date ?? null,
          transportDetails: expense.transportDetails ?? null,
        }
      : undefined,
  });

  console.log(errors);

  useEffect(() => {
    if (!expense) return;

    reset({
      category: expense.category,
      merchant: expense.merchant ?? "",
      description: expense.description ?? "",
      amount: expense.amount,
      date: expense.date ?? null,
      transportDetails: expense.transportDetails ?? null,
    });
  }, [expense, reset]);

  async function onSubmit(values: FormValues) {
    console.log("here");

    if (!expense?.id) return;

    const res = await fetch(`/api/extracted-expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      // optional: toast / error boundary
      return;
    }

    reset();
    // TODO: add local state for optimistic UI
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent className="flex flex-col">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1"
        >
          <SheetHeader>
            <SheetTitle>Extracted Expense</SheetTitle>
            <SheetDescription>
              AI-extracted expense details from this receipt.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 px-4 overflow-y-auto">
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
                      <Input id="category" {...register("category")} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
                      <Input id="merchant" {...register("merchant")} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="description">Description</FieldLabel>
                      <Input id="description" {...register("description")} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="amount">Amount</FieldLabel>
                      <Input
                        id="amount"
                        type="number"
                        {...register("amount")}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="date">Date</FieldLabel>
                      <Input id="date" {...register("date")} />
                    </Field>
                  </FieldGroup>
                </FieldSet>

                {expense.transportDetails && (
                  <>
                    <FieldSeparator />
                    <FieldSet>
                      <FieldLegend variant="label">
                        Transport Details
                      </FieldLegend>
                      <FieldDescription>
                        Transport-specific details regarding your receipt
                      </FieldDescription>

                      <FieldGroup>
                        <Field>
                          <FieldLabel htmlFor="mode">Mode</FieldLabel>
                          <Input
                            id="mode"
                            {...register("transportDetails.mode")}
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="mileage">Mileage</FieldLabel>
                          <Input
                            id="mileage"
                            {...register("transportDetails.mileage")}
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
            <Button
              type="submit"
              disabled={isSubmitting}
              onClick={() => console.log("clicked")}
            >
              {isSubmitting ? "Updating..." : "Update"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
