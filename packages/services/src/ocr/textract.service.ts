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

export class TextractService implements OcrService {
  async extractText(s3Key: string): Promise<OcrResult> {
    try {
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
        avgConfidence: avgConfidence,
        success: true,
        shouldRetry: false,
      };
    } catch (error) {
      return {
        data: null,
        avgConfidence: 0,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown Textract error",
        shouldRetry: this.isRetryableError(error),
      };
    }
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
}

export const textractService = new TextractService();
