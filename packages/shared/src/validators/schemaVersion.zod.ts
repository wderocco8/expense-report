import { z } from "zod";

// Mirrors the validation constraints documented in
// docs/saas/v2/schema-v2.dbml's schema_versions_table note. Cycle
// detection across showWhen dependencies is explicitly deferred there
// (Open Question 3) and intentionally not implemented here.
const RESERVED_FIELD_KEYS = ["amount", "date"] as const;
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_FIELDS = 20;
const MAX_OPTIONS = 30;

const ShowWhenSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "neq", "in"]),
  value: z.union([z.string(), z.array(z.string())]),
});

const SchemaFieldDefinitionSchema = z.object({
  key: z
    .string()
    .regex(
      FIELD_KEY_REGEX,
      "Key must be lowercase snake_case starting with a letter (max 40 chars)",
    ),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "boolean", "enum", "multi_select"]),
  required: z.boolean(),
  extractable: z.boolean(),
  options: z.array(z.string()).max(MAX_OPTIONS).nullable().default(null),
  description: z.string().nullable(),
  groupId: z.string().nullable(),
  showWhen: ShowWhenSchema.nullable(),
  displayOrder: z.number().int(),
});

const FieldGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable(),
});

export const SchemaVersionCreateSchema = z
  .object({
    fields: z.array(SchemaFieldDefinitionSchema).max(MAX_FIELDS),
    groups: z.array(FieldGroupSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const groupIds = new Set(data.groups.map((g) => g.id));
    const seenKeys = new Set<string>();

    data.fields.forEach((field, i) => {
      if ((RESERVED_FIELD_KEYS as readonly string[]).includes(field.key)) {
        ctx.addIssue({
          code: "custom",
          message: `"${field.key}" is a reserved system field key`,
          path: ["fields", i, "key"],
        });
      }

      if (seenKeys.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate field key "${field.key}"`,
          path: ["fields", i, "key"],
        });
      }
      seenKeys.add(field.key);

      if (field.groupId && !groupIds.has(field.groupId)) {
        ctx.addIssue({
          code: "custom",
          message: `groupId "${field.groupId}" does not reference a defined group`,
          path: ["fields", i, "groupId"],
        });
      }
    });

    const referenceableKeys = new Set<string>([
      ...RESERVED_FIELD_KEYS,
      ...seenKeys,
    ]);
    data.fields.forEach((field, i) => {
      if (field.showWhen && !referenceableKeys.has(field.showWhen.field)) {
        ctx.addIssue({
          code: "custom",
          message: `showWhen.field "${field.showWhen.field}" does not reference a defined field or "amount"/"date"`,
          path: ["fields", i, "showWhen", "field"],
        });
      }
    });
  });

export type SchemaVersionCreateInput = z.infer<typeof SchemaVersionCreateSchema>;
