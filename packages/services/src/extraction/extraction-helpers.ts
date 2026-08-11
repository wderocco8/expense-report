import {
  SchemaFieldDefinition,
  // SchemaFieldType,
  // ShowWhen,
  // SlimOcrResult,
} from "@repo/db";
import z from "zod";

// function buildFieldConstraint(field: SchemaFieldDefinition): string {
//   const typeHint =
//     field.type === "enum"
//       ? `one of [${field.options?.join(", ")}]`
//       : field.type;

//   const requiredHint = field.required
//     ? "[required]"
//     : "[optional — return null if not found or not applicable]";

//   // Translate showWhen → explicit AI instruction
//   const conditionHint = field.showWhen
//     ? `Only extract if ${field.showWhen.field} ${showWhenToEnglish(field.showWhen)}; otherwise return null.`
//     : "";

//   return [
//     `- "${field.key}" (${field.label}): ${typeHint} ${requiredHint}`,
//     conditionHint,
//   ]
//     .filter(Boolean)
//     .join(" ");
// }

// function showWhenToEnglish(condition: ShowWhen): string {
//   if (condition.op === "eq") return `equals "${condition.value}"`;
//   if (condition.op === "neq") return `does not equal "${condition.value}"`;
//   if (condition.op === "in")
//     return `is one of [${(condition.value as string[]).join(", ")}]`;
//   return "";
// }

// function buildExtractionPrompt(
//   ocr: SlimOcrResult,
//   fields: SchemaFieldDefinition[],
// ): string {
//   const extractableFields = fields.filter((f) => f.extractable);
//   const fieldConstraints = extractableFields
//     .map(buildFieldConstraint)
//     .join("\n");

//   return [
//     "Extract the following fields from the receipt.",
//     "Return null for any optional field that cannot be determined from the receipt.",
//     "",
//     "Fields:",
//     fieldConstraints,
//     "",
//     buildOcrSection(ocr),
//   ].join("\n");
// }

function fieldTypeToZodBase(field: SchemaFieldDefinition): z.ZodType {
  switch (field.type) {
    case "boolean":
      return z.boolean();
    case "date":
      // TODO: confirm this only accepts "yyyy-mm-dd" format
      return z.iso.date();
    case "enum":
      return z.enum(field.options ?? []);
    case "multi_select":
      return z.array(z.enum(field.options ?? []));
    case "number":
      return z.number();
    case "text":
      return z.string();
  }
}

function fieldToZod(field: SchemaFieldDefinition): z.ZodType {
  let base = fieldTypeToZodBase(field);
  if (!field.required) {
    base = base.nullable();
  }
  return base;
}

export function buildZodSchema(fields: SchemaFieldDefinition[]) {
  const extractableFields = fields.filter((f) => f.extractable);

  const dynamicShape = Object.fromEntries([
    ...extractableFields.map((f) => [f.key, fieldToZod(f)] as const), // TODO: why is `as const` needed
  ]);

  return z.object({
    amount: z.number(),
    date: z.iso.date(),
    ...dynamicShape,
  });
}
