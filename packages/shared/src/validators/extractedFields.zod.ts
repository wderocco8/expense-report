import { z } from "zod";

interface FieldTypeInfo {
  key: string;
  type: "text" | "number" | "date" | "boolean" | "enum" | "multi_select";
  required: boolean;
  options: string[] | null;
}

function fieldValueSchema(field: FieldTypeInfo): z.ZodType {
  let base: z.ZodType;
  switch (field.type) {
    case "text":
      base = z.string();
      break;
    case "number":
      base = z.number();
      break;
    case "date":
      base = z.iso.date();
      break;
    case "boolean":
      base = z.boolean();
      break;
    case "enum":
      if (!field.options?.length)
        throw new Error(
          `Field "${field.key}" is type "enum" but has no options`,
        );
      base = z.enum(field.options as [string, ...string[]]);
      break;
    case "multi_select":
      if (!field.options?.length)
        throw new Error(
          `Field "${field.key}" is type "multi_select" but has no options`,
        );
      base = z.array(z.enum(field.options as [string, ...string[]]));
      break;
  }
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
