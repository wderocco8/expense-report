import { z } from "zod";

export const ReceiptFileUpdateSchema = z
  .object({
    jobId: z.uuid(),
    s3Key: z.string(),
    originalFilename: z.string(),
    status: z.enum([
      "pending",
      "ocr_processing",
      "ocr_complete",
      "extracting",
      "complete",
      "failed",
    ]),
    errorMessage: z.string(),
    ocrStartedAt: z.date(),
    ocrCompletedAt: z.date(),
    extractionStartedAt: z.date(),
    extractionCompletedAt: z.date(),
    ocrProvider: z.string(),
  })
  .partial();

export type ReceiptFileUpdateInput = z.infer<typeof ReceiptFileUpdateSchema>;
