import { NextResponse } from "next/server";
import { createExpenseReport } from "@/server/services/expenseReports.service";
import { ExpenseReportCreateSchema } from "@repo/shared";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";

export async function POST(req: Request) {
  try {
    const authResult = await requireApiAuth();
    if (!authResult.ok) return respondProblem(authResult.problem);

    const body = await req.json().catch(() => ({}));

    const parsed = ExpenseReportCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: z.treeifyError(parsed.error) },
        { status: 400 }
      );
    }

    const job = await createExpenseReport({
      userId: authResult.session.user.id,
      title: parsed.data.title,
    });

    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    console.error("Failed to create expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
