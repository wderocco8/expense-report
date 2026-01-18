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
import { ExtractedExpenseUpdateSchema } from "@/server/validators/extractedExpense.zod";
import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";
import useSWR from "swr";
import { ExtractedExpense, ReceiptFile } from "@/server/db/schema/app.schema";
import { FormCombobox } from "@/components/receipt-files/extracted-expenses/form-combobox";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import ReceiptPreviewDialog from "@/components/receipt-files/extracted-expenses/receipt-preview-dialog";
import ExtractedExpenseSkeleton from "@/components/receipt-files/extracted-expenses/extracted-expense-skeleton";

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

export function ExtractedExpenseSheet({
  receipt,
  open,
  onClose,
}: {
  receipt: ReceiptFile | null | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const [localExpense, setLocalExpense] = useState<ExtractedExpense | null>(
    null,
  );
  const [dateOpen, setDateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
    const source = localExpense ?? expense;

    if (!source) return;

    reset({
      category: source.category ?? "",
      merchant: source.merchant ?? "",
      description: source.description ?? "",
      amount: source.amount,
      date: source.date ?? null,
      transportDetails: source.transportDetails ?? null,
    });
  }, [localExpense, expense, reset]);

  async function onSubmit(values: FormValues) {
    if (!expense?.id) return;

    setLocalExpense({ ...expense, ...values });

    const res = await fetch(`/api/extracted-expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Encountered error updating expense");
      setLocalExpense(null);
      return;
    }

    mutate(); // ?
    toast.success("Expense has been updated");
    // reset();
    // TODO: add local state for optimistic UI
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent className="flex flex-col" side="right-resize">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetHeader>
            <SheetTitle>Extracted Expense</SheetTitle>
            <SheetDescription>
              AI-extracted expense details from this receipt.
            </SheetDescription>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Update
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
      <ReceiptPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        imageUrl={image?.url ?? null}
        imageAlt={receipt?.originalFilename ?? null}
      />
    </Sheet>
  );
}
