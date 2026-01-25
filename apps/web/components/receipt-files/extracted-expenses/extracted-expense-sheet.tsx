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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExtractedExpenseUpdateSchema } from "@repo/shared";
import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";
import useSWR from "swr";
import { ExtractedExpense, ReceiptFile } from "@repo/db";
import { FormCombobox } from "@/components/receipt-files/extracted-expenses/form-combobox";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import ReceiptPreviewDialog from "@/components/receipt-files/extracted-expenses/receipt-preview-dialog";
import ExtractedExpenseSkeleton from "@/components/receipt-files/extracted-expenses/extracted-expense-skeleton";
import { Badge } from "@/components/ui/badge";
import UnsavedChangesDialog from "@/components/receipt-files/extracted-expenses/unsaved-changes-dialog";

const CATEGORY_OPTIONS = [
  { value: "tolls/parking", label: "Tolls / Parking" },
  { value: "hotel", label: "Hotel" },
  { value: "transport", label: "Transport" },
  { value: "fuel", label: "Fuel" },
  { value: "meals", label: "Meals" },
  { value: "phone", label: "Phone" },
  { value: "supplies", label: "Supplies" },
  { value: "misc", label: "Misc" },
];

const TRANSPORT_MODE_OPTIONS = [
  { value: "car", label: "Car" },
  { value: "train", label: "Train" },
  { value: "plane", label: "Plane" },
];

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatMoney(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return n.toFixed(2);
}

type ReceiptImage = { url: string };

type ExtractedExpenseSheetProps = {
  receipt: ReceiptFile | null | undefined;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export function ExtractedExpenseSheet({
  receipt,
  open,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: ExtractedExpenseSheetProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unsavedChangesOpen, setUnsavedChangesOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<null | "prev" | "next">(null);
  const [pendingClose, setPendingClose] = useState(false);

  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  const {
    data: expense,
    isLoading,
    mutate,
  } = useSWR<ExtractedExpense>(
    () =>
      open && receipt?.id
        ? `/api/receipts/${receipt.id}/extracted-expense`
        : null,
    fetcher,
  );

  const { data: image, isLoading: isLoadingImage } = useSWR<ReceiptImage>(
    receipt?.id ? `/api/receipts/${receipt.id}/image` : null,
    fetcher,
  );

  type FormValues = z.infer<typeof ExtractedExpenseUpdateSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
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
    if (expense) {
      reset({
        category: expense.category,
        merchant: expense.merchant ?? "",
        description: expense.description ?? "",
        amount: expense.amount,
        date: expense.date ?? null,
        transportDetails: expense.transportDetails ?? null,
      });
    }
  }, [expense, reset]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  async function onSubmit(values: FormValues) {
    if (!expense?.id) return;

    const res = await fetch(`/api/extracted-expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Encountered error updating expense");
      return;
    }

    toast.success("Expense has been updated");
    mutate({ ...expense, ...values }, false); // optimistic update
    reset({ ...expense, ...values }); // reset form state to current values
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          if (isDirty) {
            setPendingClose(true);
            setUnsavedChangesOpen(true);
          } else {
            onClose();
          }
        }
      }}
    >
      <SheetContent className="flex flex-col" side="right-resize">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetHeader>
            <div className="flex justify-between items-center mt-6">
              <SheetTitle>Extracted Expense</SheetTitle>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (isDirty) {
                      setPendingNav("prev");
                      setUnsavedChangesOpen(true);
                    } else {
                      onPrev();
                    }
                  }}
                  disabled={!hasPrev}
                >
                  Prev
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (isDirty) {
                      setPendingNav("next");
                      setUnsavedChangesOpen(true);
                    } else {
                      onNext();
                    }
                  }}
                  disabled={!hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
            <SheetDescription>
              AI-extracted expense details from this receipt.
            </SheetDescription>

            <div className="border-2 rounded-lg p-2 my-2 space-y-2">
              <FieldLegend variant="label">Receipt Info</FieldLegend>

              {receipt?.originalFilename && (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <div>File:</div>
                  <Badge>{receipt.originalFilename}</Badge>
                </div>
              )}

              {image && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2 w-fit"
                  onClick={() => setPreviewOpen(true)}
                >
                  View receipt
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 min-h-0 px-4 overflow-y-auto">
            {isLoading ? (
              <ExtractedExpenseSkeleton />
            ) : !expense ? (
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
                      <FieldLabel>Category</FieldLabel>
                      <FormCombobox
                        control={control}
                        name="category"
                        options={CATEGORY_OPTIONS}
                        placeholder="Select category"
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
                                        : null,
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

                {expense?.transportDetails && (
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
                          <FormCombobox
                            control={control}
                            name="transportDetails.mode"
                            options={TRANSPORT_MODE_OPTIONS}
                            placeholder="Select transport mode"
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
                {expense && (
                  <div className="pt-4 text-xs text-muted-foreground">
                    Model version: {expense?.modelVersion}
                  </div>
                )}
              </FieldGroup>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()} // resets to the last fetched expense
              disabled={!isDirty} // only active if there are changes
            >
              Reset
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Spinner />}
              Update
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
      <UnsavedChangesDialog
        open={unsavedChangesOpen}
        onOpenChange={setUnsavedChangesOpen}
        onSubmit={() => {
          setUnsavedChangesOpen(false);

          if (pendingNav === "prev") onPrev();
          else if (pendingNav === "next") onNext();
          else if (pendingClose) onClose();

          setPendingNav(null);
          setPendingClose(false);
          reset(expense);
        }}
        onCancel={() => {
          setUnsavedChangesOpen(false);
          setPendingNav(null);
          setPendingClose(false);
        }}
      />
      <ReceiptPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        imageUrl={image?.url ?? null}
        imageAlt={receipt?.originalFilename ?? null}
      />
    </Sheet>
  );
}
