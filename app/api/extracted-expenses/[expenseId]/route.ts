import { NextResponse } from "next/server";
import { z } from "zod";
import { ExtractedExpenseUpdateSchema } from "@/server/validators/extractedExpense.zod";
import { updateExtractedExpense } from "@/server/services/extractedExpenses.service";

const ParamsSchema = z.object({
  expenseId: z.uuid(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const { expenseId } = ParamsSchema.parse(await params);

    const json = await req.json();

    const parsed = ExtractedExpenseUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: z.treeifyError(parsed.error) },
        { status: 400 }
      );
    }

    const expense = await updateExtractedExpense(expenseId, parsed.data);

    return NextResponse.json(expense, { status: 200 });
  } catch (err) {
    console.error("Failed to create expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
