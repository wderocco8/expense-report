import { getCurrentExtractedExpenseForReceipt } from "@/server/services/extractedExpenses.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = ParamsSchema.parse(await params);

    const expense = await getCurrentExtractedExpenseForReceipt(id);

    return NextResponse.json(expense, { status: 200 });
  } catch (err) {
    console.error("Failed to get expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
