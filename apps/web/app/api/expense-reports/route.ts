import { NextResponse } from "next/server";
import { createExpenseReport } from "@/server/services/expenseReports.service";
import { ExpenseReportCreateSchema } from "@repo/shared";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";

export const POST = withProblems(async (req) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const body = await req.json().catch(() => ({}));

  const parsed = ExpenseReportCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const job = await createExpenseReport({
    userId: authResult.session.user.id,
    title: parsed.data.title,
  });

  return NextResponse.json(job, { status: 201 });
});
