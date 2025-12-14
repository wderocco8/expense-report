import OpenAI from "openai";
import { ReceiptDTO, ReceiptSchema } from "@/server/validators/receipt.zod";
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
  filename: string;
  data: ReceiptDTO | null;
  success: boolean;
  error?: string;
};

export async function extractReceiptFromImage(
  file: File
): Promise<ReceiptResult> {
  const uploaded = await client.files.create({
    file,
    purpose: "vision",
  });

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: `Extract only structured JSON with: 
          merchant (if present), description, date, amount, and category (if present).

          If category === "transport", include the "transportDetails" object in your output, 
          and fill mode (if present) and mileage (if present).

          Never hallucinate. Return null rather than guessing an output.`,
      },
      {
        role: "user",
        content: [
          {
            type: "input_image",
            file_id: uploaded.id,
            detail: "low",
          },
        ],
      },
    ],
    text: ReceiptFormat,
  });

  const raw = response.output_text;

  let parsed;
  try {
    parsed = ReceiptSchema.safeParse(JSON.parse(raw));
  } catch (e) {
    console.error("Error parsing json", uploaded.filename, e);
    return {
      filename: uploaded.filename,
      data: null,
      success: false,
      error: "Model returned invalid JSON",
    };
  }

  if (!parsed.success) {
    return {
      filename: uploaded.filename,
      data: null,
      success: false,
      error: parsed.error.message,
    };
  } else {
    if (parsed.data.category !== "transport") {
      parsed.data.transportDetails = null;
    }
    return {
      filename: uploaded.filename,
      data: parsed.data,
      success: true,
    };
  }
}
