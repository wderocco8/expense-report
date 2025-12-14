import { NextResponse } from "next/server";
import heicConvert from "heic-convert";
import { extractReceiptFromImage } from "@/server/services/ocr.service";

async function convertIfNeeded(file: File) {
  if (["image/heic", "image/heif"].includes(file.type)) {
    const arrayBuffer = Buffer.from(await file.arrayBuffer());
    const uint8 = new Uint8Array(arrayBuffer);

    const jpegBuffer = await heicConvert({
      buffer: uint8 as unknown as ArrayBuffer,
      format: "JPEG",
      quality: 0.8,
    });

    return new File([jpegBuffer], file.name.replace(/\.heic$/i, ".jpg"), {
      type: "image/jpeg",
    });
  }

  return file; // already valid
}

export const runtime = "nodejs"; // required to read binary files

const VALID_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];

    if (files.length === 0) {
      return new Response("No files uploaded", { status: 400 });
    }

    // Validate file-types
    for (const file of files) {
      if (!VALID_FILE_TYPES.includes(file.type)) {
        throw new Error(
          `${file.type} is not supported. Please use: ${VALID_FILE_TYPES.join(
            ", "
          )}`
        );
      }
    }

    // Resize files
    // const resized = await sharp(file.arrayBuffer())
    //   .resize({ width: 768 }) // or even 512 for receipts
    //   .jpeg({ quality: 80 })
    //   .toBuffer();

    const normalizedFiles = await Promise.all(files.map(convertIfNeeded));

    // TODO: maybe switch to Promise.allSettled
    const results = await Promise.all(
      normalizedFiles.map(extractReceiptFromImage)
    );

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
