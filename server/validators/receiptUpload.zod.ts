import { z } from "zod";

export const ReceiptUploadSchema = z.object({
  jobId: z.uuid(),
  files: z
    .custom<FileList>(
      (val) => typeof window !== "undefined" && val instanceof FileList,
      {
        message: "Invalid file input",
      }
    )
    .refine((files) => files.length > 0, {
      message: "At least one file is required",
    })
    .refine(
      (files) => Array.from(files).every((f) => f.type.startsWith("image/")),
      {
        message: "Only image files are allowed",
      }
    ),
});

export type ReceiptUploadInput = z.infer<typeof ReceiptUploadSchema>;
