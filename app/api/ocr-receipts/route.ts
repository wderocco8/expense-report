import { NextResponse } from "next/server";
import OpenAI from "openai";
import { ResponseTextConfig } from "openai/resources/responses/responses.mjs";
import { z } from "zod";

export const runtime = "nodejs"; // required to read binary files

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const VALID_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const Receipt = z.object({
  merchant: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  date: z.string(),
  amount: z.number(),
  category: z
    .enum([
      "tolls/parking",
      "hotel",
      "transport",
      "fuel",
      "meals",
      "phone",
      "supplies",
      "misc",
    ])
    .default("misc"),
  transport_details: z
    .object({
      mode: z.enum(["train", "car", "plane"]).nullable().default(null),
      mileage: z.number().nullable().default(null),
    })
    .nullable()
    .default(null),
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
        date: { type: "string" },
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
        transport_details: {
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
        "transport_details",
      ],
      additionalProperties: false,
    },
  },
};

type ReceiptType = z.infer<typeof Receipt> | null;
type Result = {
  filename: string;
  data: ReceiptType;
  success: boolean;
  error?: string;
};

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];

    if (files.length === 0) {
      return new Response("No files uploaded", { status: 400 });
    }

    const results: Result[] = [];

    for (const file of files) {
      if (!VALID_FILE_TYPES.includes(file.type)) {
        results.push({
          filename: file.name,
          data: null,
          success: false,
          error: `${
            file.type
          } is not supported. Please use: ${VALID_FILE_TYPES.join(", ")}`,
        });
        continue;
      }
    }

    // Upload each file to OpenAI file storage
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        return client.files.create({
          file,
          purpose: "vision",
        });
      })
    );

    for (const f of uploadedFiles) {
      const response = await client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: `You are a receipt-reading assistant. Extract only structured JSON with: 
              merchant (if present), description, date, amount, and category (if present).

              If category === "transport", include the "transport_details" object in your output, 
              and fill mode (if present) and mileage (if present).

              Never hallucinate. Return null rather than guessing an output.`,
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: "what's in this image?" },
              {
                type: "input_image",
                file_id: f.id,
                detail: "auto",
              },
            ],
          },
        ],
        text: ReceiptFormat,
      });

      const raw = response.output_text;

      let parsed;
      try {
        parsed = Receipt.safeParse(JSON.parse(raw));
      } catch (e) {
        console.error("Error parsing json", f.filename, e);
        results.push({
          filename: f.filename,
          data: null,
          success: false,
          error: "Model returned invalid JSON",
        });
        continue;
      }

      if (!parsed.success) {
        results.push({
          filename: f.filename,
          data: null,
          success: false,
          error: parsed.error.message,
        });
      } else {
        results.push({
          filename: f.filename,
          data: parsed.data,
          success: true,
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    if (error instanceof Error) {
      console.error("OCR error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      console.error("An unknown error occurred:", error);
    }
  }
}
