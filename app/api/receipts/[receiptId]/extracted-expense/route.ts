import { getCurrentExtractedExpenseForReceipt } from "@/server/services/extractedExpenses.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const ParamsSchema = z.object({
  receiptId: z.uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  try {
    const { receiptId } = ParamsSchema.parse(await params);

    const expense = await getCurrentExtractedExpenseForReceipt(receiptId);

    return NextResponse.json(expense, { status: 200 });
  } catch (err) {
    console.error("Failed to get expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
