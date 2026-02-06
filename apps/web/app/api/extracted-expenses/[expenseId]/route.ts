import { NextResponse } from "next/server";
import { z } from "zod";
import { ExtractedExpenseUpdateSchema } from "@repo/shared";
import { updateExtractedExpense } from "@/server/services/extractedExpenses.service";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";

type RouteCtx = {
  params: Promise<{ expenseId: string }>;
};

export const PATCH = withProblems<RouteCtx>(async (req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) {
    return respondProblem(authResult.problem);
  }

  const expenseId = z.uuid().parse((await params).expenseId);

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
});
