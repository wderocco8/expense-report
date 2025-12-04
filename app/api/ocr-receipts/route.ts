import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const runtime = "nodejs"; // required for file processing

const Receipt = z.object({
  merchant: z.string(),
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
});

type ReceiptType = z.infer<typeof Receipt> | null;
type Result = { filename: string; data: ReceiptType };

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const results: Result[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const response = await client.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a receipt-reading assistant. Extract only structured JSON with: merchant, description, date, amount, and category (if present). Never hallucinate.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
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
