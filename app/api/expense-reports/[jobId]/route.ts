import { getExpenseReportJobWithFiles } from "@/server/repositories/expenseReports.repo";
import { NextResponse } from "next/server";

// NOTE: endpoint not currently used (only for testing purposes)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = await getExpenseReportJobWithFiles(jobId);

    return NextResponse.json(job, { status: 200 });
  } catch (err) {
    console.error("Failed to get expense report", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
