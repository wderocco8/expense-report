import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const runtime = "nodejs"; // required for file processing

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const results: unknown[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      console.log(`base64 decoded for ${file.name}`, base64);

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a receipt-reading assistant. Extract only structured JSON with: merchant, date, amount, category (if present), and any notes. Never hallucinate.",
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
      });

      // Attempt to parse model output
      let parsed;
      try {
        parsed = JSON.parse(response.choices[0].message.content || "{}");
      } catch (error) {
        console.error("Parse error:", error);
        parsed = {
          error: "Failed to parse JSON",
          raw: response.choices[0].message.content,
        };
      }

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
