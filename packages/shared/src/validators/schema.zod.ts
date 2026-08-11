import { z } from "zod";

export const SchemaCreateSchema = z.object({
  name: z.string(),
  description: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .optional()
    .or(z.literal("")),
});

export type SchemaCreateInput = z.infer<typeof SchemaCreateSchema>;
