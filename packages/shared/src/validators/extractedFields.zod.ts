import { z } from "zod";

interface FieldTypeInfo {
  key: string;
  type: "text" | "number" | "date" | "boolean" | "enum" | "multi_select";
  required: boolean;
  options: string[] | null;
}

function fieldTypeToZodBase(field: FieldTypeInfo) {
  switch (field.type) {
    case "text":
      return z.string();
    case "number":
      // Deliberately z.number(), not z.coerce.number() — coerce widens this
      // schema's input type beyond number (it'll accept a string), which
      // breaks zodResolver's Resolver<TFieldValues> assignability against
      // useForm<ExtractedExpenseFormValues>() (verified directly: z.input<>
      // on a coerced schema accepts string, on a plain one it doesn't).
      // String -> number conversion happens earlier, in the input's
      // register(name, { setValueAs }) — by the time a value reaches this
      // schema it's already a real number.
      return z.number();
    case "date":
      return z.iso.date();
    case "boolean":
      return z.boolean();
    case "enum":
      if (!field.options?.length)
        throw new Error(
          `Field "${field.key}" is type "enum" but has no options`,
        );
      return z.enum(field.options as [string, ...string[]]);
    case "multi_select":
      if (!field.options?.length)
        throw new Error(
          `Field "${field.key}" is type "multi_select" but has no options`,
        );
      return z.array(z.enum(field.options as [string, ...string[]]));
  }
}

function fieldValueSchema(field: FieldTypeInfo) {
  const base = fieldTypeToZodBase(field);
  return field.required ? base : base.nullable();
}

export function buildExtractedExpenseSchema(fields: FieldTypeInfo[]) {
  const shape = Object.fromEntries(
    fields.map((f) => [f.key, fieldValueSchema(f)] as const),
  );
  return z.object({
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
    date: z.iso.date().nullable(),
    extractedFields: z.object(shape).strict(), // rejects unknown keys — the actual upgrade from the current loose z.record
  });
}
