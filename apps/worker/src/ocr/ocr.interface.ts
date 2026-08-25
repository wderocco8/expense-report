import type { SlimOcrResult } from "@repo/db";

export interface OcrResult {
  data: SlimOcrResult | null;
  avgConfidence: number;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface OcrService {
  extractText(s3Key: string): Promise<OcrResult>;
}
