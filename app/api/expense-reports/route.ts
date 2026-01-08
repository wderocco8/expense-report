import { NextResponse } from "next/server";
import { createExpenseReport } from "@/server/services/expenseReports.service";
import { ExpenseReportCreateSchema } from "@/server/validators/expenseReport.zod";
import { z } from "zod";
import { requireActiveUserApi } from "@/lib/auth/auth-api";

export async function POST(req: Request) {
  try {
    const auth = await requireActiveUserApi();

    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));

    const parsed = ExpenseReportCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: z.treeifyError(parsed.error) },
        { status: 400 }
      );
    }

    const job = await createExpenseReport({
      userId: auth.user.id,
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
