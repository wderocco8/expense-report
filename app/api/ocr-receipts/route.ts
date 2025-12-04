import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod.mjs";
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

              If category === "transit", include the "transit_details" object in your output, 
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
        text: { format: zodTextFormat(Receipt, "receipt") },
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
