import { MAX_FILES_PER_UPLOAD } from "../domain/expense-reports/constants";
import { z } from "zod";

export const ReceiptUploadSchema = z.object({
  jobId: z.uuid(),
  files: z
    .array(z.instanceof(File))
    .min(1, "At least one file is required")
    .max(MAX_FILES_PER_UPLOAD)
    .refine(
      (files) => files.every((f) => f.type.startsWith("image/")),
      "Only image files are allowed",
    )
    .superRefine((files, ctx) => {
      if (files.length === 0) {
        ctx.addIssue({
          code: "too_small",
          minimum: 1,
          origin: "array",
          type: "array",
          inclusive: true,
          message: "At least one file is required",
        });
      }

      if (files.length > MAX_FILES_PER_UPLOAD) {
        ctx.addIssue({
          code: "too_big",
          maximum: MAX_FILES_PER_UPLOAD,
          origin: "array",
          type: "array",
          inclusive: true,
          message: `You can upload at most ${MAX_FILES_PER_UPLOAD} receipts at once`,
        });
      }

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          ctx.addIssue({
            code: "custom",
            message: "Only image files are allowed",
          });
          break;
        }
      }
    }),
});

export type ReceiptUploadInput = z.infer<typeof ReceiptUploadSchema>;
