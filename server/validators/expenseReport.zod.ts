import { z } from "zod";

export const ExpenseReportCreateSchema = z.object({
  title: z.string().min(1).optional(),
});

export type ExpenseReportCreateInput = z.infer<
  typeof ExpenseReportCreateSchema
>;
