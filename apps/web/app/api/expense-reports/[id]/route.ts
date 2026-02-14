import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { getExpenseReportWithFiles } from "@/server/services/expenseReports.service";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export const GET = withProblems<RouteCtx>(async (req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) {
    return respondProblem(authResult.problem);
  }

  const id = z.uuid().parse((await params).id);

  const expense = await getExpenseReportWithFiles(
    id,
    authResult.session.user.id,
  );

  return NextResponse.json(expense, { status: 200 });
});
