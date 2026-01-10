import { NextResponse } from "next/server";
import { ingestReceipt } from "@/server/services/receipts.service";
import { respondProblem } from "@/lib/http/respond";
import { problem } from "@/lib/http/problems";

export const runtime = "nodejs"; // required to read binary files

const VALID_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];

export async function POST(req: Request) {
  const form = await req.formData();
  const jobId = form.get("jobId") as string;
  const files = form.getAll("files") as File[];

  if (files.length === 0) {
    return respondProblem(
      problem(400, "receipt/no-files", "No files uploaded")
    );
  }

  // Validate file-types
  for (const file of files) {
    if (!VALID_FILE_TYPES.includes(file.type)) {
      return respondProblem(
        problem(
          400,
          "receipt/unsupported-file-type",
          "Unsupported file type",
          `Received ${file.type}`
        )
      );
    }
  }

  for (const file of files) {
    await ingestReceipt({ jobId, file });
  }

  return NextResponse.json({ success: true });
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
