import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const runtime = "nodejs"; // required for file processing

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

type ReceiptType = z.infer<typeof Receipt> | null;
type Result = { filename: string; data: ReceiptType; error?: string };

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const results: Result[] = [];

    for (const file of files) {
      if (!VALID_FILE_TYPES.includes(file.type)) {
        results.push({
          filename: file.name,
          data: null,
          error: `${
            file.type
          } is not supported. Please use: ${VALID_FILE_TYPES.join(", ")}`,
        });
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const response = await client.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a receipt-reading assistant. Extract only structured JSON with: 
              merchant (if present), description, date, amount, and category (if present).

              If category === "transit", include the "transit_details" object in your output, 
              and fill mode (if present) and mileage (if present).

              Never hallucinate. Return null rather than guessing an output.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/${file.type};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: "Extract the receipt information as JSON.",
              },
            ],
          },
        ],
        temperature: 0,
        max_completion_tokens: 300,
        response_format: zodResponseFormat(Receipt, "receipt"),
      });

      const parsed = response.choices[0].message.parsed;

      results.push({
        filename: file.name,
        data: parsed,
      });
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
