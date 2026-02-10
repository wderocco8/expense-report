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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExtractedExpenseUpdateSchema } from "@repo/shared";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { FormCombobox } from "@/components/receipt-files/extracted-expenses/form-combobox";
import { toast } from "sonner";

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

type ManulUploadReceiptProps = {
  jobId: string;
  onSuccess: () => void;
  onSubmittingChange: (v: boolean) => void;
};

export function ManualUploadReceipt({
  jobId,
  onSuccess,
  onSubmittingChange,
}: ManulUploadReceiptProps) {
  const [dateOpen, setDateOpen] = useState(false);

  type FormValues = z.infer<typeof ExtractedExpenseUpdateSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(ExtractedExpenseUpdateSchema),
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch(`/api/receipt-files`, {
      // TODO: add new endpoint
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Encountered error updating expense");
      return;
    }

    toast.success("Expense has been updated");
    reset({ ...values }); // reset form state to current values
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col flex-1 h-full"
    >
      <div className="flex-1 px-4 overflow-y-auto">
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
                            {date ? date.toLocaleDateString() : "Select date"}
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
                                date ? date.toISOString().slice(0, 10) : null,
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

          <FieldSeparator />
          <FieldSet>
            <FieldLegend variant="label">Transport Details</FieldLegend>
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

              <Field data-invalid={!!errors.transportDetails?.mileage}>
                <FieldLabel htmlFor="mileage">Mileage</FieldLabel>
                <Input
                  id="mileage"
                  aria-invalid={!!errors.transportDetails?.mileage}
                  {...register("transportDetails.mileage")}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>
    </form>
  );
}
