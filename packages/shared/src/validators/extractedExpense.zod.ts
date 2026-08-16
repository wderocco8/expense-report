import { z } from "zod";

// Mirrors ExtractedFields (packages/db/src/types/schema.types.ts) structurally
// rather than importing it — packages/shared has no dependency on @repo/db
// (which pulls in the Neon driver, server-only) and shouldn't gain one just
// for a type. Same pattern already used in schemaVersion.zod.ts.
const ExtractedFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export const ExtractedExpenseUpdateSchema = z
  .object({
    date: z.iso.date().nullable(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
    // NOT validated per-field against a schema version's type/enum/options
    // here (would need receiptId -> job -> schemaVersionId -> fields
    // threaded through this endpoint) — deliberately deferred, same
    // category as the showWhen-on-update enforcement in Decision 10.
    extractedFields: z.record(z.string(), ExtractedFieldValueSchema),
  })
  .partial();

export type ExtractedExpenseUpdateInput = z.infer<
  typeof ExtractedExpenseUpdateSchema
>;
