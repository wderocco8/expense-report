import { NextResponse } from "next/server";
import { ingestReceipt } from "@/server/services/receipts.service";

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
    const jobId = form.get("jobId") as string;
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

    for (const file of files) {
      await ingestReceipt({ jobId, file });
    }

    return NextResponse.json({ success: true });
    // return NextResponse.json({ success: true, results });
  } catch (error) {
    if (error instanceof Error) {
      console.error("OCR error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      console.error("An unknown error occurred:", error);
    }
  }
}

/**
 * TODO: Validation
 * import { ReceiptUploadSchema } from "@/server/validators/receiptUpload.zod";

export async function POST(req: Request) {
  const formData = await req.formData();

  const jobId = formData.get("jobId");
  const files = formData.getAll("files");

  const parsed = ReceiptUploadSchema.safeParse({
    jobId,
    files: {
      length: files.length,
      item: (i: number) => files[i],
      [Symbol.iterator]: () => files[Symbol.iterator](),
    },
  });

  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error), { status: 400 });
  }

  // continue with OCR
}

 */
