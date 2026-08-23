import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SchemaFieldDefinition } from "@repo/db";
import { Control, FieldErrors, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import DateFieldInput from "@/components/receipt-files/extracted-expenses/dynamic/DateFieldInput";
import { FormCombobox } from "@/components/receipt-files/extracted-expenses/form-combobox";
import { ExtractedExpenseFormValues } from "@/components/receipt-files/extracted-expenses/dynamic/types";

interface DynamicFieldInputProps {
  field: SchemaFieldDefinition;
  control: Control<ExtractedExpenseFormValues>;
  register: UseFormRegister<ExtractedExpenseFormValues>;
  errors: FieldErrors<ExtractedExpenseFormValues>;
  isSubmitting: boolean;
}

export default function DynamicFieldInput({
  field,
  control,
  register,
  errors,
  isSubmitting,
}: DynamicFieldInputProps) {
  const name =
    `extractedFields.${field.key}` as Path<ExtractedExpenseFormValues>;
  const error = errors.extractedFields?.[field.key];

  return (
    <Field data-invalid={!!error}>
      <FieldLabel>
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </FieldLabel>

      {field.type === "date" && (
        <DateFieldInput name={name} control={control} disabled={isSubmitting} />
      )}

      {field.type === "enum" && (
        <FormCombobox
          control={control}
          name={name}
          disabled={isSubmitting}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))} // TODO: may need the value to be no-spaces (kebab case)
          placeholder={`Select ${field.label.toLowerCase()}`}
        />
      )}

      {(field.type === "text" || field.type === "number") && (
        <Input
          id={name}
          disabled={isSubmitting}
          inputMode={field.type === "number" ? "decimal" : undefined}
          aria-invalid={!!error}
          {...register(name, {
            // Native inputs always submit strings, and "" when cleared.
            // Convert here — before the value ever reaches the zod schema —
            // rather than using z.coerce.number(), which widens the
            // schema's input type and breaks zodResolver's Resolver<T>
            // typing against useForm<ExtractedExpenseFormValues>().
            setValueAs: (v) => {
              if (v === "") return null;
              return field.type === "number" ? Number(v) : v;
            },
          })}
        />
      )}

      {(field.type === "boolean" || field.type === "multi_select") && (
        <div className="text-sm text-muted-foreground">
          {field.type} not yet supported
        </div>
      )}

      <FieldError errors={error ? [error] : undefined} />
    </Field>
  );
}
