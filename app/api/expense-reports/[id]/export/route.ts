import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { exportExpenseReport } from "@/server/services/expenseReports.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireApiAuth({ role: "member" });
    if (!authResult.ok) {
      return respondProblem(authResult.problem);
    }

    const { id } = ParamsSchema.parse(await params);

    const buffer = await exportExpenseReport(id);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="expense-report-${id}.xlsx"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Failed to get expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
