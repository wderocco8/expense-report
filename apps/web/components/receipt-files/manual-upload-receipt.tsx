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
import { ReceiptFileAddSchema } from "@repo/shared";
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

  type FormValues = z.input<typeof ReceiptFileAddSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(ReceiptFileAddSchema),
  });

  async function onSubmit(values: FormValues) {
    const formData = new FormData();

    formData.append("payload", JSON.stringify(values.payload));
    formData.append("image", values.image);

    const res = await fetch(`/api/expense-reports/${jobId}/receipts`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      toast.error("Encountered error creating expense");
      return;
    }

    toast.success("Expense has been created");
    reset({ ...values }); // reset form state to current values
  }

  return (
    <form
      id="manual-upload-form"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col flex-1 h-full"
    >
      <div className="flex-1 overflow-y-auto">
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Expense Details</FieldLegend>
            <FieldDescription>
              General details regarding your expense
            </FieldDescription>

            <FieldGroup>
              <Field data-invalid={!!errors.image}>
                <FieldLabel>Receipt Image</FieldLabel>

                <Controller
                  name="image"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        field.onChange(file);
                      }}
                    />
                  )}
                />
              </Field>

              <Field data-invalid={!!errors?.payload?.category}>
                <FieldLabel>Category</FieldLabel>
                <FormCombobox
                  control={control}
                  name="payload.category"
                  options={CATEGORY_OPTIONS}
                  placeholder="Select category"
                />
              </Field>

              <Field data-invalid={!!errors?.payload?.merchant}>
                <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
                <Input
                  id="merchant"
                  aria-invalid={!!errors?.payload?.merchant}
                  {...register("payload.merchant")}
                />
              </Field>

              <Field data-invalid={!!errors?.payload?.description}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Input
                  id="description"
                  aria-invalid={!!errors?.payload?.description}
                  {...register("payload.description")}
                />
              </Field>

              <Field data-invalid={!!errors?.payload?.amount}>
                <FieldLabel htmlFor="amount">Amount</FieldLabel>
                <Input
                  id="amount"
                  inputMode="decimal"
                  aria-invalid={!!errors?.payload?.amount}
                  {...register("payload.amount", {
                    onBlur: (e) => {
                      const formatted = formatMoney(e.target.value);
                      e.target.value = formatted;
                    },
                  })}
                />
              </Field>

              <Field data-invalid={!!errors?.payload?.date}>
                <FieldLabel htmlFor="date">Date</FieldLabel>

                <Controller
                  name="payload.date"
                  control={control}
                  render={({ field }) => {
                    const date = field.value
                      ? parseDateOnly(field.value)
                      : undefined;

                    return (
                      <Popover
                        open={dateOpen}
                        onOpenChange={setDateOpen}
                        aria-invalid={!!errors?.payload?.date}
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
              <Field data-invalid={!!errors?.payload?.transportDetails?.mode}>
                <FieldLabel htmlFor="mode">Mode</FieldLabel>
                <FormCombobox
                  control={control}
                  name="payload.transportDetails.mode"
                  options={TRANSPORT_MODE_OPTIONS}
                  placeholder="Select transport mode"
                />
              </Field>

              <Field
                data-invalid={!!errors?.payload?.transportDetails?.mileage}
              >
                <FieldLabel htmlFor="mileage">Mileage</FieldLabel>
                <Input
                  id="mileage"
                  aria-invalid={!!errors?.payload?.transportDetails?.mileage}
                  {...register("payload.transportDetails.mileage")}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>
    </form>
  );
}
