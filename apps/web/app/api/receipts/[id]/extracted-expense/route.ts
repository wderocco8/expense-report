import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { getCurrentExtractedExpenseForReceipt } from "@/server/services/extractedExpenses.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.uuid(),
});

export const GET = withProblems(async (req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) {
    return respondProblem(authResult.problem);
  }

  const { id } = ParamsSchema.parse(await params);

  const expense = await getCurrentExtractedExpenseForReceipt(id);

  return NextResponse.json(expense, { status: 200 });
});
