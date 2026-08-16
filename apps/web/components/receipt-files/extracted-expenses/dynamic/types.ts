import { ExtractedFields } from "@repo/db";

export interface ExtractedExpenseFormValues {
  amount: string;
  date: string | null;
  extractedFields: ExtractedFields;
}
