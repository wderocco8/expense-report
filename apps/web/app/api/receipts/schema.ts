import { z } from "zod";

export const ConfirmSchema = z.object({ receiptIds: z.array(z.uuid()).min(1) });

export type ConfirmBody = z.infer<typeof ConfirmSchema>;
