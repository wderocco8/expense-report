import { z } from "zod";

export const ReceiptSchema = z.object({
  merchant: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  amount: z.number(),
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
      mileage: z.number().nullable().default(null),
    })
    .nullable()
    .default(null),
});

export type ReceiptDTO = z.infer<typeof ReceiptSchema>;

export const ReceiptFileUpdateSchema = z
  .object({
    jobId: z.uuid(),
    s3Key: z.string(),
    originalFilename: z.string(),
    status: z.enum(["pending", "processing", "complete", "failed"]),
    errorMessage: z.string(),
  })
  .partial();

export type ReceiptFileUpdateInput = z.infer<typeof ReceiptFileUpdateSchema>;
