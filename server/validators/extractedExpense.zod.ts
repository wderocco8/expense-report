import { z } from "zod";

const TransportDetailsSchema = z.object({
  mode: z.enum(["train", "car", "plane"]).nullable(),
  mileage: z.number().nonnegative().nullable(),
});

export const ExtractedExpenseUpdateSchema = z
  .object({
    category: z.enum([
      "tolls/parking",
      "hotel",
      "transport",
      "fuel",
      "meals",
      "phone",
      "supplies",
      "misc",
    ]),
    merchant: z.string().min(1).max(255).nullable(),
    description: z.string().max(500).nullable(),
    date: z.iso.date().nullable(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
    transportDetails: TransportDetailsSchema.nullable(),
  })
  .partial();

export type ExtractedExpenseUpdateInput = z.infer<
  typeof ExtractedExpenseUpdateSchema
>;
