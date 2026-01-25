import { z } from "zod";

export const ExpenseReportCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .optional()
    .or(z.literal("")),
});

export type ExpenseReportCreateInput = z.infer<
  typeof ExpenseReportCreateSchema
>;
