import OpenAI from "openai";
import { ExtractionResult, ExtractionService } from "./extraction.interface";
import { ReceiptExtractionSchema } from "./extraction.schema";
import { ResponseTextConfig } from "openai/resources/responses/responses.mjs";
import { SlimOcrResult } from "@repo/db";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const ReceiptFormat: ResponseTextConfig = {
  format: {
    type: "json_schema",
    name: "receipt",
    strict: true,
    schema: {
      type: "object",
      properties: {
        merchant: { type: "string", nullable: true },
        description: { type: "string", nullable: true },
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        amount: { type: "number" },
        category: {
          type: "string",
          enum: [
            "tolls/parking",
            "hotel",
            "transport",
            "fuel",
            "meals",
            "phone",
            "supplies",
            "misc",
          ],
        },
        transportDetails: {
          type: "object",
          nullable: true,
          properties: {
            mode: {
              type: "string",
              nullable: true,
              enum: ["train", "car", "plane"],
            },
            mileage: { type: "number", nullable: true },
          },
          required: ["mode", "mileage"],
          additionalProperties: false,
        },
      },
      required: [
        "merchant",
        "description",
        "date",
        "amount",
        "category",
        "transportDetails",
      ],
      additionalProperties: false,
    },
  },
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

export class OpenAIExtractionService implements ExtractionService {
  async extractFromText(ocrText: SlimOcrResult): Promise<ExtractionResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.callOpenAI(ocrText);
        return result;
      } catch (error) {
        lastError = error;

        if (this.isRateLimitError(error) && attempt < MAX_RETRIES) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error
        return {
          data: null,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          shouldRetry: false,
        };
      }
    }

    return {
      data: null,
      success: false,
      error: `Failed after ${MAX_RETRIES} attempts: ${lastError}`,
      shouldRetry: false,
    };
  }

  private async callOpenAI(ocrText: SlimOcrResult): Promise<ExtractionResult> {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            "Extract structured expense data from the following OCR output.",
            "",
            "RAW TEXT:",
            ocrText.rawText,
            "",
            "SUMMARY FIELDS:",
            JSON.stringify(ocrText.summaryFields, null, 2),
            "",
            "LINE ITEMS:",
            JSON.stringify(ocrText.lineItems, null, 2),
          ].join("\n"),
        },
      ],
      text: ReceiptFormat,
    });

    const parsed = ReceiptExtractionSchema.safeParse(
      JSON.parse(response.output_text),
    );

    if (!parsed.success) {
      return {
        data: null,
        success: false,
        error: `Schema validation failed: ${parsed.error.message}`,
        shouldRetry: false,
      };
    }

    // NOTE: clear transit data if category is not "transport"
    if (parsed.data.category !== "transport") {
      parsed.data.transportDetails = null;
    }

    return {
      data: parsed.data,
      success: true,
      shouldRetry: false,
    };
  }

  private isRateLimitError(error: unknown): boolean {
    return (
      error instanceof OpenAI.APIError &&
      (error.status === 429 || error.code === "rate_limit_exceeded")
    );
  }

  private getRetryDelay(attempt: number): number {
    return BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const openaiExtractionService = new OpenAIExtractionService();
