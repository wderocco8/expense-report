import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { exportExpenseReport } from "@/server/services/expenseReports.service";
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

  const buffer = await exportExpenseReport(id);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="expense-report-${id}.xlsx"`,
      "Content-Length": buffer.length.toString(),
    },
  });
});
