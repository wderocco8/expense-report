import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { problem } from "@/lib/problems/problem";
import { presignReceiptUploads } from "@/server/services/receipts.service";
import { VALID_FILE_TYPES } from "@repo/shared";
import { getExpenseReport } from "@/server/services/expenseReports.service";
import { PresignSchema } from "./schema";

export const POST = withProblems(async (req) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const body = await req.json();
  const { jobId, files } = PresignSchema.parse(body);

  for (const file of files) {
    if (!VALID_FILE_TYPES.includes(file.type)) {
      return respondProblem(
        problem(
          400,
          "receipt/unsupported-file-type",
          "Unsupported file type",
          `Received ${file.type}`,
        ),
      );
    }
  }

  const job = await getExpenseReport(jobId, authResult.session.user.id);
  if (!job) {
    return respondProblem(
      problem(404, "expense-report/not-found", "Expense report not found"),
    );
  }

  const uploads = await presignReceiptUploads(jobId, files);

  return NextResponse.json({ uploads });
});
