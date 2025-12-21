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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExtractedExpenseUpdateSchema } from "@/server/validators/extractedExpense.zod";
import { useEffect, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatMoney(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return n.toFixed(2);
}

export function ExtractedExpenseSheet({
  receipt,
  open,
  onClose,
}: {
  receipt: ReceiptFileWithExpenses | null | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);

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
    control,
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
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetHeader>
            <SheetTitle>Extracted Expense</SheetTitle>
            <SheetDescription>
              AI-extracted expense details from this receipt.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 px-4 overflow-y-auto">
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
                    <Field data-invalid={!!errors.category}>
                      <FieldLabel htmlFor="category">Category</FieldLabel>
                      <Controller
                        name="category"
                        control={control}
                        render={({ field }) => (
                          <Select
                            aria-invalid={!!errors.category}
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger id="category">
                              <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tolls/parking">
                                Tolls / Parking
                              </SelectItem>
                              <SelectItem value="hotel">Hotel</SelectItem>
                              <SelectItem value="transport">
                                Transport
                              </SelectItem>
                              <SelectItem value="fuel">Fuel</SelectItem>
                              <SelectItem value="meals">Meals</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="supplies">Supplies</SelectItem>
                              <SelectItem value="misc">Misc</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>

                    <Field data-invalid={!!errors.merchant}>
                      <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
                      <Input
                        id="merchant"
                        aria-invalid={!!errors.merchant}
                        {...register("merchant")}
                      />
                    </Field>

                    <Field data-invalid={!!errors.description}>
                      <FieldLabel htmlFor="description">Description</FieldLabel>
                      <Input
                        id="description"
                        aria-invalid={!!errors.description}
                        {...register("description")}
                      />
                    </Field>

                    <Field data-invalid={!!errors.amount}>
                      <FieldLabel htmlFor="amount">Amount</FieldLabel>
                      <Input
                        id="amount"
                        inputMode="decimal"
                        aria-invalid={!!errors.amount}
                        {...register("amount", {
                          onBlur: (e) => {
                            const formatted = formatMoney(e.target.value);
                            e.target.value = formatted;
                          },
                        })}
                      />
                    </Field>

                    <Field data-invalid={!!errors.date}>
                      <FieldLabel htmlFor="date">Date</FieldLabel>

                      <Controller
                        name="date"
                        control={control}
                        render={({ field }) => {
                          const date = field.value
                            ? parseDateOnly(field.value)
                            : undefined;

                          return (
                            <Popover
                              open={dateOpen}
                              onOpenChange={setDateOpen}
                              aria-invalid={!!errors.date}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  id="date"
                                  className="w-48 justify-between font-normal"
                                >
                                  {date
                                    ? date.toLocaleDateString()
                                    : "Select date"}
                                  <ChevronDownIcon />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto overflow-hidden p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={date}
                                  captionLayout="dropdown"
                                  onSelect={(date) => {
                                    field.onChange(
                                      date
                                        ? date.toISOString().slice(0, 10)
                                        : null
                                    );
                                    setDateOpen(false);
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                          );
                        }}
                      />
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
                        <Field data-invalid={!!errors.transportDetails?.mode}>
                          <FieldLabel htmlFor="mode">Mode</FieldLabel>
                          <Input
                            id="mode"
                            aria-invalid={!!errors.transportDetails?.mode}
                            {...register("transportDetails.mode")}
                          />
                        </Field>

                        <Field
                          data-invalid={!!errors.transportDetails?.mileage}
                        >
                          <FieldLabel htmlFor="mileage">Mileage</FieldLabel>
                          <Input
                            id="mileage"
                            aria-invalid={!!errors.transportDetails?.mileage}
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
            <Button type="submit" disabled={isSubmitting}>
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
