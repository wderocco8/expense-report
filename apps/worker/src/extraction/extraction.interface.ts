import { ExtractedFields, SlimOcrResult } from "@repo/db";
import { z } from "zod";

export interface ExtractionResult {
  data: ({ amount: number; date: string } & ExtractedFields) | null;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface ExtractionService {
  extractFromText(
    ocrText: SlimOcrResult,
    zodSchemaVersion: z.ZodObject,
  ): Promise<ExtractionResult>;
}
