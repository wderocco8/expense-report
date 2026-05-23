import { SlimOcrResult } from "@repo/db";
import { ReceiptDTO } from "@repo/shared";

export interface ExtractionResult {
  data: ReceiptDTO | null;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface ExtractionService {
  extractFromText(ocrText: SlimOcrResult): Promise<ExtractionResult>;
}
