import { getReceiptFile } from "@/server/services/receipts.service";
import { getSignedReceiptUrl } from "@/server/services/storage.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = ParamsSchema.parse(await params);

    // TODO: ensure receipt.userId === session.user.id
    const receipt = await getReceiptFile(id);

    const url = await getSignedReceiptUrl(receipt.s3Key);

    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    console.error("Failed to get receipt image", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
