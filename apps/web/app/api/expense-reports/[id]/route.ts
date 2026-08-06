import { requireApiAuth } from "@/lib/auth/api";
import { isAdmin } from "@/lib/auth/roles";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { getExpenseReportJobById } from "@/server/services/expenseReports.service";
import { expenseReportJobProblems } from "@/lib/problems/domain/expenseReportJob";
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

  const job = await getExpenseReportJobById(id);

  if (
    !job ||
    (job.userId !== authResult.session.user.id &&
      !isAdmin(authResult.session.user))
  ) {
    throw expenseReportJobProblems.notFoundById(id);
  }

  return NextResponse.json(job, { status: 200 });
});
