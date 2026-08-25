import OpenAI from "openai";
import { ExtractionResult, ExtractionService } from "./extraction.interface";
import { ExtractedFields, SlimOcrResult } from "@repo/db";
import { zodTextFormat } from "openai/helpers/zod";
import z from "zod";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

export class OpenAIExtractionService implements ExtractionService {
  async extractFromText(
    ocrText: SlimOcrResult,
    zodSchemaVersion: z.ZodObject,
  ): Promise<ExtractionResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.callOpenAI(ocrText, zodSchemaVersion);
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

  private async callOpenAI(
    ocrText: SlimOcrResult,
    zodSchemaVersion: z.ZodObject,
  ): Promise<ExtractionResult> {
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
      text: { format: zodTextFormat(zodSchemaVersion, "schema") },
    });

    const parsed = zodSchemaVersion.safeParse(JSON.parse(response.output_text));
    const data = parsed.data as {
      amount: number;
      date: string;
    } & ExtractedFields;

    if (!parsed.success) {
      return {
        data: null,
        success: false,
        error: `Schema validation failed: ${parsed.error.message}`,
        shouldRetry: false,
      };
    }

    return {
      data,
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
