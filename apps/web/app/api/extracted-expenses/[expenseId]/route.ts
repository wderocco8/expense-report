import { NextResponse } from "next/server";
import { z } from "zod";
import { ExtractedExpenseUpdateSchema } from "@repo/shared";
import { updateExtractedExpense } from "@/server/services/extractedExpenses.service";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";

const ParamsSchema = z.object({
  expenseId: z.uuid(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  try {
    const authResult = await requireApiAuth();
    if (!authResult.ok) {
      return respondProblem(authResult.problem);
    }

    const { expenseId } = ParamsSchema.parse(await params);

    const json = await req.json();

    const parsed = ExtractedExpenseUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: z.treeifyError(parsed.error) },
        { status: 400 },
      );
    }

    const expense = await updateExtractedExpense(expenseId, parsed.data);

    return NextResponse.json(expense, { status: 200 });
  } catch (err) {
    console.error("Failed to create expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
