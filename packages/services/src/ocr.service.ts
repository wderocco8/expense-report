import OpenAI from "openai";
import { ReceiptDTO, ReceiptSchema } from "@repo/shared";
import { ResponseTextConfig } from "openai/resources/responses/responses.mjs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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

export type ReceiptResult = {
  data: ReceiptDTO | null;
  success: boolean;
  error?: string;
};

/** Maximum number of retries for rate limit errors  */
const MAX_RETRIES = 3;
/** Base delay in milliseconds for exponential backoff */
const BASE_DELAY_MS = 200;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 * Jitter helps prevent thundering herd when multiple requests fail simultaneously
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
  // Add random jitter between 0-100ms
  const jitter = Math.random() * 100;
  return exponentialDelay + jitter;
}

/**
 * Check if an error is a rate limit (429) error from OpenAI
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429 || error.code === "rate_limit_exceeded";
  }
  return false;
}

/**
 * Check if an error should be retried
 * Only 429 rate limit errors should be retried
 */
function shouldRetryError(error: unknown): boolean {
  return isRateLimitError(error);
}

async function extractReceiptWithOpenAI(buffer: Buffer): Promise<string> {
  const base64Image = buffer.toString("base64");

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: `Extract only structured JSON with: 
          merchant (if present), description, date, amount, and category (if present).

          Date should be yyyy-mm-dd format.

          If category === "transport", include the "transportDetails" object in your output, 
          and fill mode (if present) and mileage (if present).

          Never hallucinate. Return null rather than guessing an output.`,
      },
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${base64Image}`,
            detail: "auto",
          },
        ],
      },
    ],
    text: ReceiptFormat,
  });

  return response.output_text;
}

export async function extractReceiptFromImage(
  buffer: Buffer,
): Promise<ReceiptResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await extractReceiptWithOpenAI(buffer);

      let parsed;
      try {
        parsed = ReceiptSchema.safeParse(JSON.parse(raw));
      } catch (e) {
        console.error("Error parsing json", e);
        // JSON parse errors should not be retried - return failure
        return {
          data: null,
          success: false,
          error: "Model returned invalid JSON",
        };
      }

      if (!parsed.success) {
        // Schema validation errors should not be retried - return failure
        return {
          data: null,
          success: false,
          error: parsed.error.message,
        };
      } else {
        if (parsed.data.category !== "transport") {
          parsed.data.transportDetails = null;
        }
        return {
          data: parsed.data,
          success: true,
        };
      }
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetryError(error)) {
        if (attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt);
          console.log(
            `[OCR] Rate limit hit on attempt ${attempt}/${MAX_RETRIES}. Retrying in ${Math.round(delay)}ms...`,
          );
          await sleep(delay);
          continue;
        } else {
          console.error(
            `[OCR] Rate limit persisted after ${MAX_RETRIES} attempts. Giving up.`,
          );
        }
      } else {
        // Non-retryable error - log and throw to bubble up to caller
        console.error(
          `[OCR] Non-retryable error on attempt ${attempt}:`,
          error,
        );
        throw error;
      }
    }
  }

  // If we exhausted all retries, return a failure result
  const errorMessage =
    lastError instanceof Error ? lastError.message : "Unknown error";
  return {
    data: null,
    success: false,
    error: `Failed after ${MAX_RETRIES} attempts due to rate limiting: ${errorMessage}`,
  };
}
