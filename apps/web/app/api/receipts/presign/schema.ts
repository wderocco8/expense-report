import { MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE_BYTES } from "@repo/shared";
import { z } from "zod";

export const PresignSchema = z.object({
  jobId: z.uuid(),
  files: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        type: z.string(),
        size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_UPLOAD),
});

export type PresignBody = z.infer<typeof PresignSchema>;
