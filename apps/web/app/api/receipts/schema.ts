import { z } from "zod";

export const ConfirmSchema = z
  .object({
    successReceiptIds: z.array(z.uuid()),
    failedReceiptIds: z.array(z.uuid()),
  })
  .refine((d) => d.successReceiptIds.length + d.failedReceiptIds.length > 0, {
    message: "At least one receiptId must be provided",
  });

export type ConfirmBody = z.infer<typeof ConfirmSchema>;
