import { MAX_FILES_PER_UPLOAD } from "@repo/shared";
import { z } from "zod";

export const PresignSchema = z.object({
  jobId: z.uuid(),
  files: z
    .array(z.object({ id: z.uuid(), name: z.string(), type: z.string() }))
    .min(1)
    .max(MAX_FILES_PER_UPLOAD),
});

export type PresignBody = z.infer<typeof PresignSchema>;
