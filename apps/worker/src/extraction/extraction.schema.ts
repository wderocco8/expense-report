import { z } from "zod";

export const ReceiptExtractionSchema = z.object({
  merchant: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number(),
  category: z
    .enum([
      "tolls/parking",
      "hotel",
      "transport",
      "fuel",
      "meals",
      "phone",
      "supplies",
      "misc",
    ])
    .default("misc"),
  transportDetails: z
    .object({
      mode: z.enum(["train", "car", "plane"]).nullable().default(null),
      mileage: z.coerce.number().nullable().default(null),
    })
    .nullable()
    .default(null),
});

export type ReceiptExtractionDTO = z.infer<typeof ReceiptExtractionSchema>;
