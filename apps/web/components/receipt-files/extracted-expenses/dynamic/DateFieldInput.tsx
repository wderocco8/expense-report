import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { PopoverContent } from "@radix-ui/react-popover";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Control, Controller, Path } from "react-hook-form";
import { ExtractedExpenseFormValues } from "@/components/receipt-files/extracted-expenses/dynamic/types";

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

interface DateFieldInputProps {
  name: Path<ExtractedExpenseFormValues>;
  control: Control<ExtractedExpenseFormValues>;
  disabled: boolean;
}

export default function DateFieldInput({
  name,
  control,
  disabled,
}: DateFieldInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        // DateFieldInput is only ever rendered for type: "date" fields (see
        // DynamicFieldInput's gate) — this is genuinely a date string or null.
        // TS can't know that here since this component type-checks against
        // every possible key the wide Path<ExtractedExpenseFormValues> allows.
        const value = field.value as string | null;
        const date = value ? parseDateOnly(value) : undefined;

        return (
          <Popover
            open={open}
            onOpenChange={setOpen}
            // aria-invalid={!!errors.date}
          >
            <PopoverTrigger asChild>
              <Button
                id="date"
                disabled={disabled}
                variant="outline"
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
                disabled={disabled}
                selected={date}
                captionLayout="dropdown"
                onSelect={(date) => {
                  field.onChange(date ? date.toISOString().slice(0, 10) : null);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        );
      }}
    />
  );
}
