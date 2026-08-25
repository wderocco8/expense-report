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
      return z.number({ error: "Enter a valid number" });
    case "date":
      return z.iso.date();
    case "boolean":
      return z.boolean();
    case "enum":
      if (!field.options?.length)
        throw new Error(
          `Field "${field.key}" is type "enum" but has no options`,
        );
      return z.enum(field.options as [string, ...string[]], {
        error: "Select a valid option",
      });
    case "multi_select":
      if (!field.options?.length)
        throw new Error(
          `Field "${field.key}" is type "multi_select" but has no options`,
        );
      return z.array(z.enum(field.options as [string, ...string[]]), {
        error: "Select a valid option",
      });
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
    extractedFields: z.object(shape).strict(),
  });
}
