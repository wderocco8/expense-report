import { NextResponse } from "next/server";
import { createExpenseReport } from "@/server/services/expenseReports.service";
import { ExpenseReportCreateSchema } from "@/server/validators/expenseReport.zod";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const parsed = ExpenseReportCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: z.treeifyError(parsed.error) },
        { status: 400 }
      );
    }

    const job = await createExpenseReport(parsed.data);

    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    console.error("Failed to create expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
