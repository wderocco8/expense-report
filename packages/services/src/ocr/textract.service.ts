import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeExpenseCommand,
} from "@aws-sdk/client-textract";
import { OcrResult, OcrService } from "./ocr.interface";
import { SlimOcrResult } from "@repo/db";

// TODO: either combine or create independent variables for region
const TEXTRACT_REGION = process.env.S3_REGION;
const S3_BUCKET = process.env.S3_BUCKET;
const TEXTRACT_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const TEXTRACT_SECRET_KEY = process.env.S3_SECRET_KEY;

// Explicitly set the real AWS endpoint to bypass any LocalStack AWS_ENDPOINT_URL injection
const textract = new TextractClient({
  region: TEXTRACT_REGION,
  endpoint: `https://textract.${TEXTRACT_REGION}.amazonaws.com`,
  credentials: {
    accessKeyId: TEXTRACT_ACCESS_KEY!,
    secretAccessKey: TEXTRACT_SECRET_KEY!,
  },
});

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export class TextractService implements OcrService {
  async extractText(s3Key: string): Promise<OcrResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callTextract(s3Key);
      } catch (error) {
        lastError = error;

        if (this.isRetryableError(error) && attempt < MAX_RETRIES) {
          const delay = this.getRetryDelay(attempt);
          console.warn(
            `[Textract] Throttled (attempt ${attempt}/${MAX_RETRIES}) for ${s3Key}, retrying in ${delay}ms`,
          );
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error — fail immediately
        return {
          data: null,
          avgConfidence: 0,
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown Textract error",
          shouldRetry: false,
        };
      }
    }

    // All retries exhausted on a throttle
    return {
      data: null,
      avgConfidence: 0,
      success: false,
      error: `Textract failed after ${MAX_RETRIES} attempts: ${lastError instanceof Error ? lastError.message : lastError}`,
      shouldRetry: false,
    };
  }

  private async callTextract(s3Key: string): Promise<OcrResult> {
    const command = new AnalyzeExpenseCommand({
      Document: {
        S3Object: {
          Bucket: S3_BUCKET,
          Name: s3Key,
        },
      },
    });

    const response = await textract.send(command);

    const doc = response.ExpenseDocuments?.[0];
    if (!doc) {
      return {
        data: null,
        avgConfidence: 0,
        success: false,
        error: "No expense document returned",
        shouldRetry: false,
      };
    }

    // Strip geometry from summary fields
    const summaryFields = (doc.SummaryFields ?? []).map((f) => ({
      type: f.Type?.Text ?? "OTHER",
      label: f.LabelDetection?.Text ?? null,
      value: f.ValueDetection?.Text ?? "",
      confidence: f.ValueDetection?.Confidence ?? 0,
    }));

    // Strip geometry from line items
    const lineItems = (doc.LineItemGroups ?? []).flatMap((group) =>
      (group.LineItems ?? []).map((item) => {
        const fields = Object.fromEntries(
          (item.LineItemExpenseFields ?? []).map((f) => [
            f.Type?.Text,
            f.ValueDetection?.Text ?? null,
          ]),
        );
        return {
          description: fields["ITEM"] ?? null,
          quantity: fields["QUANTITY"] ?? null,
          unitPrice: fields["UNIT_PRICE"] ?? null,
          total: fields["PRICE"] ?? null,
          row: fields["EXPENSE_ROW"] ?? null,
        };
      }),
    );

    // rawText: all LINE blocks — completeness guarantee, no geometry
    const rawText = (doc.Blocks ?? [])
      .filter((b) => b.BlockType === "LINE")
      .map((b) => b.Text ?? "")
      .join("\n");

    const avgConfidence =
      summaryFields.length > 0
        ? summaryFields.reduce((sum, f) => sum + f.confidence, 0) /
          summaryFields.length
        : 0;

    const slim: SlimOcrResult = { summaryFields, lineItems, rawText };

    return {
      data: slim,
      avgConfidence,
      success: true,
      shouldRetry: false,
    };
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      return [
        "ThrottlingException",
        "ProvisionedThroughputExceededException",
        "ServiceUnavailable",
      ].includes(error.name);
    }
    return false;
  }

  private getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s (+ up to 200ms jitter)
    return BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 200;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const textractService = new TextractService();
