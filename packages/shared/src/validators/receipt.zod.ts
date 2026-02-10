import { z } from "zod";
import { VALID_FILE_TYPES } from "../domain/expense-reports/constants";

export const ReceiptSchema = z.object({
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

const ImageFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Image is required")
  .refine(
    (file) => VALID_FILE_TYPES.includes(file.type),
    `Only ${VALID_FILE_TYPES.join(",")} allowed`,
  );

export const ReceiptFileAddSchema = z.object({
  payload: ReceiptSchema,
  image: ImageFileSchema,
});
